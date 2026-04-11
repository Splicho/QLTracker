import fs from "node:fs";
import path from "node:path";
import type { PickupStatsRelayEvent } from "@qltracker/contracts";
import zmq from "zeromq";
import { config, SLOT_DEFINITIONS, type SlotDefinition } from "./config.js";
import { postPickupStatsEvents } from "./stats-callback-client.js";
import { parseZmqMessage } from "./stats-parser.js";
import { readSlotState } from "./slots.js";

export type SlotEvent = {
  type: string;
  data: unknown;
  timestamp: string;
};

export type SlotPlayer = {
  name: string;
  steamId: string;
  team: string;
};

type SlotBuffer = {
  currentMatchId: string | null;
  events: SlotEvent[];
  nextEventIndex: number;
  outbound: Promise<void>;
  players: Map<string, SlotPlayer>;
  retryTimer: NodeJS.Timeout | null;
  socket: zmq.Socket | null;
};

const MAX_EVENTS = 500;
const MAX_ZMQ_FRAME_PREVIEW = 240;
const TRACKED_EVENT_TYPES = new Set([
  "MATCH_STARTED",
  "ROUND_OVER",
  "MATCH_REPORT",
  "PLAYER_STATS",
  "PLAYER_DEATH",
  "PLAYER_KILL",
  "PLAYER_MEDAL",
  "PLAYER_SWITCHTEAM",
]);
const slotBuffers = new Map<number, SlotBuffer>();

function createBuffer(): SlotBuffer {
  return {
    currentMatchId: null,
    events: [],
    nextEventIndex: 0,
    outbound: Promise.resolve(),
    players: new Map(),
    retryTimer: null,
    socket: null,
  };
}

function getSlotDefinition(slotId: number) {
  return SLOT_DEFINITIONS.find((slot) => slot.id === slotId) ?? null;
}

function pushEvent(buffer: SlotBuffer, type: string, data: unknown) {
  const event: SlotEvent = {
    type,
    data,
    timestamp: new Date().toISOString(),
  };

  buffer.events.push(event);
  if (buffer.events.length > MAX_EVENTS) {
    buffer.events = buffer.events.slice(-MAX_EVENTS);
  }
}

function getZmqPassFile(slotId: number) {
  return path.join(
    config.slotsDir,
    `slot-${slotId}`,
    "home",
    "baseq3",
    "zmqpass.txt",
  );
}

function readZmqCredentials(slotId: number) {
  const file = getZmqPassFile(slotId);
  if (!fs.existsSync(file)) {
    return null;
  }

  const line = fs
    .readFileSync(file, "utf8")
    .split(/\r?\n/)
    .map((value) => value.trim())
    .find((value) => value.length > 0 && value.includes("="));

  if (!line) {
    return null;
  }

  const separatorIndex = line.indexOf("=");
  const username = line.slice(0, separatorIndex).trim();
  const password = line.slice(separatorIndex + 1).trim();
  if (!username || !password) {
    return null;
  }

  return { password, username };
}

function syncMatchContext(slot: SlotDefinition, buffer: SlotBuffer) {
  const state = readSlotState(slot);
  const matchId =
    state.token && state.matchId && !state.matchId.startsWith("manual-")
      ? state.matchId
      : null;

  if (buffer.currentMatchId !== matchId) {
    buffer.currentMatchId = matchId;
    buffer.nextEventIndex = 0;
  }

  return {
    matchId,
    state,
  };
}

function updatePlayers(buffer: SlotBuffer, type: string, data: Record<string, unknown>) {
  switch (type) {
    case "PLAYER_CONNECT": {
      const steamId = String(data.STEAM_ID ?? "");
      const name = String(data.NAME ?? "unknown");
      const team = String(data.TEAM ?? "spectator");
      if (steamId) {
        buffer.players.set(steamId, { name, steamId, team });
      }
      break;
    }

    case "PLAYER_DISCONNECT": {
      const steamId = String(data.STEAM_ID ?? "");
      if (steamId) {
        buffer.players.delete(steamId);
      }
      break;
    }

    case "PLAYER_SWITCHTEAM": {
      const player = data.PLAYER as Record<string, unknown> | undefined;
      const steamId = String(player?.STEAM_ID ?? data.STEAM_ID ?? "");
      const team = String(player?.TEAM ?? data.TEAM ?? "spectator");
      const existing = steamId ? buffer.players.get(steamId) : undefined;
      if (existing) {
        existing.team = team;
      }
      break;
    }

    default:
      break;
  }
}

function queueStatsRelay(
  buffer: SlotBuffer,
  slotId: number,
  matchId: string,
  event: PickupStatsRelayEvent,
) {
  buffer.outbound = buffer.outbound
    .then(() =>
      postPickupStatsEvents({
        events: [event],
        matchId,
        slotId,
      }),
    )
    .catch((error) => {
      console.error(
        `[zmq] failed to relay stats event for slot ${slotId} match ${matchId}:`,
        error,
      );
    });
}

function scheduleReconnect(slotId: number, zmqPort: number, delayMs = 1000) {
  const buffer = slotBuffers.get(slotId);
  if (!buffer || buffer.retryTimer) {
    return;
  }

  buffer.retryTimer = setTimeout(() => {
    const latest = slotBuffers.get(slotId);
    if (latest) {
      latest.retryTimer = null;
    }
    attachSocket(slotId, zmqPort);
  }, delayMs);
}

function relayTrackedEvent(
  slot: SlotDefinition,
  buffer: SlotBuffer,
  type: string,
  data: Record<string, unknown>,
) {
  const { matchId } = syncMatchContext(slot, buffer);
  if (!matchId || !TRACKED_EVENT_TYPES.has(type)) {
    return;
  }

  const eventIndex = ++buffer.nextEventIndex;
  queueStatsRelay(buffer, slot.id, matchId, {
    data,
    eventAt: new Date().toISOString(),
    eventIndex,
    source: "zmq",
    type,
  });
}

function formatFramePreview(frame: Buffer) {
  const text = frame.toString("utf8").replace(/\s+/g, " ").trim();
  if (text.length <= MAX_ZMQ_FRAME_PREVIEW) {
    return text;
  }

  return `${text.slice(0, MAX_ZMQ_FRAME_PREVIEW)}...`;
}

function logZmqFrames(
  slotId: number,
  frames: readonly Buffer[],
  context: "parsed" | "unparsed",
) {
  const summary = frames.map((frame, index) => ({
    index,
    preview: formatFramePreview(frame),
    size: frame.length,
  }));

  console.info(
    `[zmq] slot ${slotId} ${context} frames ${JSON.stringify(summary)}`,
  );
}

function handleZmqMessage(slotId: number, raw: Buffer | readonly Buffer[]) {
  const slot = getSlotDefinition(slotId);
  const buffer = slotBuffers.get(slotId);
  if (!slot || !buffer) {
    return;
  }

  const frames = Array.isArray(raw) ? raw : [raw];
  const parsed = parseZmqMessage(raw);
  if (!parsed) {
    logZmqFrames(slotId, frames, "unparsed");
    return;
  }

  logZmqFrames(slotId, frames, "parsed");
  console.info(
    `[zmq] slot ${slotId} parsed event ${parsed.type} for ${
      buffer.currentMatchId ?? "no-active-match"
    }`,
  );

  updatePlayers(buffer, parsed.type, parsed.data);
  pushEvent(buffer, parsed.type, parsed.data);
  relayTrackedEvent(slot, buffer, parsed.type, parsed.data);
}

function attachSocket(slotId: number, zmqPort: number) {
  const slot = getSlotDefinition(slotId);
  const buffer = slotBuffers.get(slotId);
  if (!slot || !buffer) {
    return;
  }

  const credentials = config.zmqStatsPassword ? readZmqCredentials(slotId) : null;
  if (config.zmqStatsPassword && !credentials) {
    scheduleReconnect(slotId, zmqPort);
    return;
  }

  const socket = zmq.socket("sub");
  const authSocket = socket as unknown as {
    plainPassword?: string;
    plainUsername?: string;
  };

  if (credentials) {
    authSocket.plainUsername = credentials.username;
    authSocket.plainPassword = credentials.password;
  }

  socket.connect(`tcp://127.0.0.1:${zmqPort}`);
  socket.subscribe("");

  socket.on("message", (...frames: Buffer[]) => {
    handleZmqMessage(slotId, frames);
  });

  socket.on("error", (error: Error) => {
    console.error(`[zmq] slot ${slotId} error:`, error.message);
  });

  buffer.socket = socket;
  console.info(
    `[zmq] connected to slot ${slotId} on 127.0.0.1:${zmqPort}${credentials ? " with auth" : ""}`,
  );
}

export function connectSlot(slotId: number, zmqPort: number) {
  disconnectSlot(slotId);

  const buffer = createBuffer();
  slotBuffers.set(slotId, buffer);
  attachSocket(slotId, zmqPort);
}

export function disconnectSlot(slotId: number) {
  const buffer = slotBuffers.get(slotId);
  if (!buffer) {
    return;
  }

  if (buffer.socket) {
    try {
      buffer.socket.close();
    } catch {
      // Ignore close errors.
    }
  }

  if (buffer.retryTimer) {
    clearTimeout(buffer.retryTimer);
  }

  slotBuffers.delete(slotId);
  console.info(`[zmq] disconnected from slot ${slotId}`);
}

export function getSlotEvents(slotId: number, since?: string): SlotEvent[] {
  const buffer = slotBuffers.get(slotId);
  if (!buffer) {
    return [];
  }

  if (!since) {
    return buffer.events;
  }

  return buffer.events.filter((event) => event.timestamp > since);
}

export function getSlotPlayers(slotId: number): SlotPlayer[] {
  const buffer = slotBuffers.get(slotId);
  if (!buffer) {
    return [];
  }

  return Array.from(buffer.players.values());
}

export function recordSupplementalEvent(
  slotId: number,
  type: "QLTRACKER_SUPPLEMENTAL_END" | "QLTRACKER_SUPPLEMENTAL_START",
  data: Record<string, unknown>,
) {
  const slot = getSlotDefinition(slotId);
  const buffer = slotBuffers.get(slotId);
  if (!slot || !buffer) {
    return;
  }

  pushEvent(buffer, type, data);

  const { matchId } = syncMatchContext(slot, buffer);
  if (!matchId) {
    return;
  }

  const eventIndex = ++buffer.nextEventIndex;
  queueStatsRelay(buffer, slotId, matchId, {
    data,
    eventAt: new Date().toISOString(),
    eventIndex,
    source: "plugin",
    type,
  });
}

export function initializeZmqForActiveSlots() {
  for (const slot of SLOT_DEFINITIONS) {
    const state = readSlotState(slot);
    if (state.state !== "idle") {
      connectSlot(slot.id, slot.zmqPort);
    }
  }
}
