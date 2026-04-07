import cors from "cors";
import express from "express";
import http from "node:http";
import { Server } from "socket.io";
import { config } from "./config.js";
import { pool } from "./db.js";
import { enrichSnapshots } from "./enrichment.js";
import {
  cleanupServerHistory,
  fetchServerHistory,
  getHistorySampleTime,
  upsertServerHistorySamples,
} from "./history.js";
import {
  fetchPlayerNameHistory,
  fetchPlayerNameHistoryLookup,
  upsertPlayerNameHistory,
} from "./player-name-history.js";
import { createPickupService } from "./pickup.js";
import { fetchSteamSnapshots } from "./steam.js";
import {
  serverSnapshotSchema,
  type PlayerPresence,
  type ServerSnapshot,
} from "./types.js";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: config.corsOrigins,
  },
});
const pickupService = createPickupService(io);

app.use(
  cors({
    origin: config.corsOrigins,
    credentials: true,
  })
);
app.use(
  express.json({
    limit: "1mb",
    verify: (request, _response, buffer) => {
      (request as express.Request & { rawBody?: string }).rawBody = buffer.toString(
        "utf8"
      );
    },
  })
);

let playerPresenceBySteamId = new Map<string, PlayerPresence>();
let snapshotsByAddr = new Map<string, ServerSnapshot>();
let lastHistorySampleAt: string | null = null;

function getRoomName(addr: string) {
  return `server:${addr}`;
}

function getPresenceRoomName(steamId: string) {
  return `presence:${steamId}`;
}

function normalizeStringArray(input: unknown) {
  return Array.isArray(input)
    ? input
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
    : [];
}

async function upsertServerSnapshot(snapshot: ServerSnapshot) {
  const normalizedSnapshot = {
    ...snapshot,
    updatedAt: snapshot.updatedAt ?? new Date().toISOString(),
  };

  await pool.query(
    `
      insert into realtime.server_snapshots (addr, payload, updated_at)
      values ($1, $2::jsonb, now())
      on conflict (addr) do update
      set payload = excluded.payload,
          updated_at = excluded.updated_at
    `,
    [snapshot.addr, JSON.stringify(normalizedSnapshot)]
  );

  return normalizedSnapshot;
}

async function broadcastSnapshot(snapshot: ServerSnapshot) {
  io.to(getRoomName(snapshot.addr)).emit("server:snapshot", snapshot);
  io.emit("server:snapshot", snapshot);
}

function buildPlayerPresenceIndex(snapshots: ServerSnapshot[]) {
  const nextIndex = new Map<string, PlayerPresence>();

  for (const snapshot of snapshots) {
    for (const player of snapshot.playersInfo) {
      const steamId = player.steamId?.trim();
      if (!steamId) {
        continue;
      }

      nextIndex.set(steamId, {
        steamId,
        playerName: player.name,
        addr: snapshot.addr,
        serverName: snapshot.name,
        map: snapshot.map,
        gameMode: snapshot.gameMode ?? null,
        team: player.team ?? null,
        players: snapshot.players,
        maxPlayers: snapshot.maxPlayers,
        countryCode: snapshot.countryCode ?? null,
        countryName: snapshot.countryName ?? null,
        updatedAt: snapshot.updatedAt ?? new Date().toISOString(),
      });
    }
  }

  return nextIndex;
}

function replaceSnapshotsIndex(snapshots: ServerSnapshot[]) {
  snapshotsByAddr = new Map(
    snapshots.map((snapshot) => [snapshot.addr, snapshot] as const)
  );
}

function haveSamePresence(
  left: PlayerPresence | null | undefined,
  right: PlayerPresence | null | undefined
) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function broadcastPlayerPresenceChanges(nextIndex: Map<string, PlayerPresence>) {
  const steamIds = new Set([
    ...playerPresenceBySteamId.keys(),
    ...nextIndex.keys(),
  ]);

  for (const steamId of steamIds) {
    const currentPresence = playerPresenceBySteamId.get(steamId) ?? null;
    const nextPresence = nextIndex.get(steamId) ?? null;

    if (haveSamePresence(currentPresence, nextPresence)) {
      continue;
    }

    io.to(getPresenceRoomName(steamId)).emit("player:presence", {
      steamId,
      presence: nextPresence,
    });
  }

  playerPresenceBySteamId = nextIndex;
}

function rebuildAndBroadcastPlayerPresence() {
  broadcastPlayerPresenceChanges(
    buildPlayerPresenceIndex(Array.from(snapshotsByAddr.values()))
  );
}

async function hydrateStateFromDb() {
  const result = await pool.query<{
    payload: ServerSnapshot;
  }>("select payload from realtime.server_snapshots");

  const snapshots = result.rows
    .map((row) => row.payload)
    .filter((payload): payload is ServerSnapshot => payload != null);

  replaceSnapshotsIndex(snapshots);
  playerPresenceBySteamId = buildPlayerPresenceIndex(snapshots);
}

async function maybeCollectHistorySnapshots(snapshots: ServerSnapshot[]) {
  const now = new Date();
  const sampleTime = getHistorySampleTime(now, config.historySampleIntervalMs);
  const sampleTimeIso = sampleTime.toISOString();

  if (lastHistorySampleAt === sampleTimeIso) {
    return;
  }

  await upsertServerHistorySamples(snapshots, sampleTime);
  await cleanupServerHistory(config.historyRetentionDays);
  lastHistorySampleAt = sampleTimeIso;
}

async function runPollCycle() {
  if (!config.steamApiKey) {
    return;
  }

  const snapshots = await fetchSteamSnapshots();
  const enrichedSnapshots = await enrichSnapshots(snapshots, snapshotsByAddr);
  replaceSnapshotsIndex(enrichedSnapshots);
  await upsertPlayerNameHistory(enrichedSnapshots);

  for (const snapshot of enrichedSnapshots) {
    const storedSnapshot = await upsertServerSnapshot(snapshot);
    await broadcastSnapshot(storedSnapshot);
  }

  rebuildAndBroadcastPlayerPresence();
  await maybeCollectHistorySnapshots(enrichedSnapshots);

  console.log(`qltracker-realtime synced ${enrichedSnapshots.length} snapshots`);
}

function isAuthorizedIngestRequest(request: express.Request) {
  const headerToken =
    request.header("x-api-key") ??
    request.header("authorization")?.replace(/^Bearer\s+/i, "");

  return headerToken === config.ingestToken;
}

app.get("/health", async (_request, response) => {
  const result = await pool.query("select now() as now");

  response.json({
    ok: true,
    now: result.rows[0]?.now ?? null,
  });
});

app.get("/api/pickup/public-state", async (_request, response) => {
  try {
    response.json({
      ok: true,
      state: await pickupService.getPublicState(),
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Pickup state unavailable.",
    });
  }
});

app.get("/api/pickup/me/state", async (request, response) => {
  const authorization = request.header("authorization");
  const token = authorization?.replace(/^Bearer\s+/i, "").trim() ?? "";
  if (!token) {
    response.status(401).json({ ok: false, error: "Missing pickup session token." });
    return;
  }

  try {
    const state = await pickupService.getPlayerStateByToken(token);
    if (!state) {
      response.status(401).json({ ok: false, error: "Pickup session is invalid." });
      return;
    }

    response.json({
      ok: true,
      state,
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Pickup state unavailable.",
    });
  }
});

app.post("/api/pickup/callbacks/provisioned", async (request, response) => {
  await pickupService.handleProvisionCallback(
    request as express.Request & { rawBody?: string },
    response
  );
});

app.post("/api/pickup/callbacks/live", async (request, response) => {
  await pickupService.handleLiveCallback(
    request as express.Request & { rawBody?: string },
    response
  );
});

app.post("/api/pickup/callbacks/result", async (request, response) => {
  await pickupService.handleResultCallback(
    request as express.Request & { rawBody?: string },
    response
  );
});

app.get("/api/servers/:addr", async (request, response) => {
  const addr = decodeURIComponent(request.params.addr);
  const result = await pool.query(
    "select payload, updated_at from realtime.server_snapshots where addr = $1",
    [addr]
  );

  if (result.rowCount === 0) {
    response.status(404).json({ ok: false, error: "Server snapshot not found." });
    return;
  }

  response.json({
    ok: true,
    snapshot: result.rows[0]?.payload ?? null,
    updatedAt: result.rows[0]?.updated_at ?? null,
  });
});

app.get("/api/servers/:addr/history", async (request, response) => {
  const addr = decodeURIComponent(request.params.addr).trim();
  const range =
    typeof request.query.range === "string" ? request.query.range.trim() : "7d";
  const bucket =
    typeof request.query.bucket === "string"
      ? request.query.bucket.trim()
      : "15m";

  if (!addr) {
    response.status(400).json({ ok: false, error: "Server address is required." });
    return;
  }

  try {
    const history = await fetchServerHistory(addr, range, bucket);
    response.json({
      ok: true,
      summary: history.summary,
      timeline: history.timeline,
    });
  } catch (error) {
    response.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : "Invalid history query.",
    });
  }
});

app.post("/api/servers/lookup", async (request, response) => {
  const addrs = normalizeStringArray((request.body as { addrs?: unknown })?.addrs);

  if (addrs.length === 0) {
    response.json({ ok: true, snapshots: [] });
    return;
  }

  const result = await pool.query(
    "select payload from realtime.server_snapshots where addr = any($1::text[])",
    [addrs]
  );

  response.json({
    ok: true,
    snapshots: result.rows.map((row) => row.payload),
  });
});

app.get("/api/presence/:steamId", (request, response) => {
  const steamId = decodeURIComponent(request.params.steamId).trim();
  const presence = steamId ? (playerPresenceBySteamId.get(steamId) ?? null) : null;

  response.json({
    ok: true,
    presence,
  });
});

app.post("/api/presence/lookup", (request, response) => {
  const steamIds = normalizeStringArray(
    (request.body as { steamIds?: unknown })?.steamIds
  );

  response.json({
    ok: true,
    presences: Object.fromEntries(
      steamIds.map((steamId) => [steamId, playerPresenceBySteamId.get(steamId) ?? null])
    ),
  });
});

app.get("/api/players/:steamId/name-history", async (request, response) => {
  const steamId = decodeURIComponent(request.params.steamId).trim();
  if (!steamId) {
    response.status(400).json({ ok: false, error: "SteamID is required." });
    return;
  }

  response.json({
    ok: true,
    names: await fetchPlayerNameHistory(steamId),
  });
});

app.post("/api/players/name-history/lookup", async (request, response) => {
  const steamIds = normalizeStringArray(
    (request.body as { steamIds?: unknown })?.steamIds
  );

  response.json({
    ok: true,
    histories: await fetchPlayerNameHistoryLookup(steamIds),
  });
});

app.post("/api/ingest/server-snapshot", async (request, response) => {
  if (!isAuthorizedIngestRequest(request)) {
    response.status(401).json({ ok: false, error: "Unauthorized." });
    return;
  }

  const parsedSnapshot = serverSnapshotSchema.safeParse(request.body);
  if (!parsedSnapshot.success) {
    response.status(400).json({
      ok: false,
      error: "Invalid snapshot payload.",
      issues: parsedSnapshot.error.flatten(),
    });
    return;
  }

  const snapshot = await upsertServerSnapshot(parsedSnapshot.data);
  await upsertPlayerNameHistory([snapshot]);
  snapshotsByAddr.set(snapshot.addr, snapshot);
  rebuildAndBroadcastPlayerPresence();
  await maybeCollectHistorySnapshots(Array.from(snapshotsByAddr.values()));
  await broadcastSnapshot(snapshot);

  response.status(202).json({
    ok: true,
    snapshot,
  });
});

io.on("connection", async (socket) => {
  const pickupSession = await pickupService.authenticateSocket(socket);
  socket.emit("realtime:ready", {
    connectedAt: new Date().toISOString(),
  });

  socket.on("servers:subscribe", async (payload: unknown) => {
    const addrs = normalizeStringArray((payload as { addrs?: unknown })?.addrs);

    if (addrs.length === 0) {
      return;
    }

    for (const addr of addrs) {
      await socket.join(getRoomName(addr));
    }

    const result = await pool.query(
      "select payload from realtime.server_snapshots where addr = any($1::text[])",
      [addrs]
    );

    for (const row of result.rows) {
      socket.emit("server:snapshot", row.payload);
    }
  });

  socket.on("presence:subscribe", (payload: unknown) => {
    const steamId =
      typeof (payload as { steamId?: unknown })?.steamId === "string"
        ? (payload as { steamId: string }).steamId.trim()
        : "";

    if (!steamId) {
      return;
    }

    void socket.join(getPresenceRoomName(steamId));
    socket.emit("player:presence", {
      steamId,
      presence: playerPresenceBySteamId.get(steamId) ?? null,
    });
  });

  socket.on("presence:unsubscribe", (payload: unknown) => {
    const steamId =
      typeof (payload as { steamId?: unknown })?.steamId === "string"
        ? (payload as { steamId: string }).steamId.trim()
        : "";

    if (!steamId) {
      return;
    }

    void socket.leave(getPresenceRoomName(steamId));
  });

  await pickupService.handleSocketConnection(socket, pickupSession);
});

server.listen(config.port, () => {
  console.log(`qltracker-realtime listening on port ${config.port}`);

  void hydrateStateFromDb()
    .then(() => {
      console.log(
        `qltracker-realtime hydrated ${snapshotsByAddr.size} cached snapshots`
      );
    })
    .catch((error: unknown) => {
      console.error("State hydration failed:", error);
    });

  void pickupService.hydrate().catch((error: unknown) => {
    console.error("Pickup hydration failed:", error);
  });

  if (!config.steamApiKey) {
    console.warn(
      "STEAM_API_KEY is not configured. Automatic Steam polling is disabled."
    );
    return;
  }

  void runPollCycle().catch((error: unknown) => {
    console.error("Initial Steam sync failed:", error);
  });

  setInterval(() => {
    void runPollCycle().catch((error: unknown) => {
      console.error("Steam sync failed:", error);
    });
  }, config.pollIntervalMs);
});
