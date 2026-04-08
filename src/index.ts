import crypto from "node:crypto";
import express from "express";
import { z } from "zod";
import { config, ensureAppDirectories, SLOT_DEFINITIONS } from "./config.js";
import { createSignature } from "./signing.js";
import {
  allocateSlot,
  markSlotResultPosted,
  markSlotReady,
  prepareManualSlot,
  readSlotMetadata,
  readSlotState,
  reconcileSlots,
  releaseSlot,
  startSlot,
  stopSlot,
} from "./slots.js";
import { provisionPayloadSchema } from "./types.js";
import { connectSlot, disconnectSlot, getSlotEvents, getSlotPlayers, initializeZmqForActiveSlots } from "./zmq-consumer.js";

type PendingReady = {
  reject: (error: Error) => void;
  resolve: () => void;
  timeout: NodeJS.Timeout;
};

const app = express();
app.use(express.json({ limit: "1mb" }));

const pendingReady = new Map<number, PendingReady>();

function requireProvisionAuth(request: express.Request) {
  const header = request.header("authorization")?.trim() ?? "";
  if (header !== `Bearer ${config.provisionAuthToken}`) {
    throw new Error("Unauthorized.");
  }
}

function waitForReady(slotId: number) {
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingReady.delete(slotId);
      reject(new Error("Timed out while waiting for the game server to become ready."));
    }, config.provisionReadyTimeoutMs);

    pendingReady.set(slotId, { reject, resolve, timeout });
  });
}

function resolveReady(slotId: number) {
  const pending = pendingReady.get(slotId);
  if (!pending) {
    return;
  }

  clearTimeout(pending.timeout);
  pendingReady.delete(slotId);
  pending.resolve();
}

function rejectReady(slotId: number, error: Error) {
  const pending = pendingReady.get(slotId);
  if (!pending) {
    return;
  }

  clearTimeout(pending.timeout);
  pendingReady.delete(slotId);
  pending.reject(error);
}

async function postRealtimeCallback(
  url: string,
  callbackName: string,
  payload: Record<string, unknown>,
) {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const rawBody = JSON.stringify(payload);
      const response = await fetch(url, {
        body: rawBody,
        headers: {
          "Content-Type": "application/json",
          "x-pickup-signature": createSignature(config.callbackSecret, rawBody),
        },
        method: "POST",
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Realtime ${callbackName} callback failed (${response.status}): ${text}`);
      }

      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < 5) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 2_000));
      }
    }
  }

  throw lastError ?? new Error(`Realtime ${callbackName} callback failed.`);
}

async function postMatchLive(matchId: string) {
  await postRealtimeCallback(config.realtimeLiveCallbackUrl, "live", {
    matchId,
  });
}

async function postMatchResult(matchId: string, winnerTeam: "left" | "right", finalScore: string | null) {
  await postRealtimeCallback(config.realtimeResultCallbackUrl, "result", {
    finalScore,
    matchId,
    winnerTeam,
  });
}

function getSlotById(slotId: number) {
  return SLOT_DEFINITIONS.find((slot) => slot.id === slotId) ?? null;
}

app.get("/healthz", async (_request, response) => {
  await reconcileSlots();
  response.json({
    ok: true,
    slots: SLOT_DEFINITIONS.map((slot) => readSlotState(slot)),
  });
});

app.post("/api/pickups/provision", async (request, response) => {
  try {
    requireProvisionAuth(request);
    const payload = provisionPayloadSchema.parse(request.body);
    const allocation = await allocateSlot(payload);
    if (!allocation) {
      response.status(409).json({
        ok: false,
        error: "All pickup server slots are currently busy.",
      });
      return;
    }

    try {
      await startSlot(allocation.slot.id);
      connectSlot(allocation.slot.id, allocation.slot.zmqPort);
      await waitForReady(allocation.slot.id);
      response.json({
        ip: config.publicIp,
        joinAddress: `${config.publicIp}:${allocation.slot.gamePort}`,
        port: allocation.slot.gamePort,
      });
    } catch (error) {
      rejectReady(allocation.slot.id, error instanceof Error ? error : new Error(String(error)));
      await stopSlot(allocation.slot.id);
      disconnectSlot(allocation.slot.id);
      releaseSlot(allocation.slot.id);
      response.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 401;
    response.status(status).json({
      ok: false,
      error: error instanceof Error ? error.message : "Unauthorized.",
    });
  }
});

app.post("/internal/slots/:slotId/ready", async (request, response) => {
  const schema = z.object({
    matchId: z.string().min(1),
    token: z.string().min(1),
  });

  try {
    const slotId = Number(request.params.slotId);
    const payload = schema.parse(request.body);
    const slot = getSlotById(slotId);
    if (!slot) {
      response.status(404).json({ ok: false, error: "Unknown slot." });
      return;
    }

    const state = readSlotState(slot);
    if (state.token !== payload.token || state.matchId !== payload.matchId) {
      response.status(403).json({ ok: false, error: "Invalid slot token." });
      return;
    }

    console.info(`[pickup] slot ${slotId} ready for match ${payload.matchId}`);
    markSlotReady(slotId);
    resolveReady(slotId);
    response.json({ ok: true });
  } catch (error) {
    console.error(`[pickup] ready callback failed for slot ${request.params.slotId}:`, error);
    response.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/internal/slots/:slotId/live", async (request, response) => {
  const schema = z.object({
    matchId: z.string().min(1),
    token: z.string().min(1),
  });

  try {
    const slotId = Number(request.params.slotId);
    const payload = schema.parse(request.body);
    const slot = getSlotById(slotId);
    if (!slot) {
      response.status(404).json({ ok: false, error: "Unknown slot." });
      return;
    }

    const state = readSlotState(slot);
    if (state.token !== payload.token || state.matchId !== payload.matchId) {
      response.status(403).json({ ok: false, error: "Invalid slot token." });
      return;
    }

    await postMatchLive(payload.matchId);
    console.info(`[pickup] slot ${slotId} live for match ${payload.matchId}`);
    response.json({ ok: true });
  } catch (error) {
    console.error(`[pickup] live callback failed for slot ${request.params.slotId}:`, error);
    response.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/internal/slots/:slotId/completed", async (request, response) => {
  const schema = z.object({
    finalScore: z.string().nullable().default(null),
    matchId: z.string().min(1),
    token: z.string().min(1),
    winnerTeam: z.enum(["left", "right"]),
  });

  try {
    const slotId = Number(request.params.slotId);
    const payload = schema.parse(request.body);
    const slot = SLOT_DEFINITIONS.find((value) => value.id === slotId);
    if (!slot) {
      response.status(404).json({ ok: false, error: "Unknown slot." });
      return;
    }

    const state = readSlotState(slot);
    if (state.token !== payload.token || state.matchId !== payload.matchId) {
      response.status(403).json({ ok: false, error: "Invalid slot token." });
      return;
    }

    await postMatchResult(payload.matchId, payload.winnerTeam, payload.finalScore);
    markSlotResultPosted(slotId);
    console.info(
      `[pickup] slot ${slotId} completed match ${payload.matchId} winner=${payload.winnerTeam} finalScore=${payload.finalScore}`,
    );
    response.json({ ok: true });

    setTimeout(async () => {
      await stopSlot(slotId);
      disconnectSlot(slotId);
      releaseSlot(slotId);
    }, config.postMatchGraceSeconds * 1000);
  } catch (error) {
    console.error(`[pickup] completed callback failed for slot ${request.params.slotId}:`, error);
    response.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/internal/slots/:slotId/failed", async (request, response) => {
  const schema = z.object({
    error: z.string().min(1),
    matchId: z.string().min(1),
    token: z.string().min(1),
  });

  try {
    const slotId = Number(request.params.slotId);
    const payload = schema.parse(request.body);
    const slot = SLOT_DEFINITIONS.find((value) => value.id === slotId);
    if (!slot) {
      response.status(404).json({ ok: false, error: "Unknown slot." });
      return;
    }

    const state = readSlotState(slot);
    if (state.token !== payload.token || state.matchId !== payload.matchId) {
      response.status(403).json({ ok: false, error: "Invalid slot token." });
      return;
    }

    rejectReady(slotId, new Error(payload.error));
    await stopSlot(slotId);
    disconnectSlot(slotId);
    releaseSlot(slotId);
    response.json({ ok: true });
  } catch (error) {
    response.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.get("/internal/slots/:slotId/metadata", (request, response) => {
  const slotId = Number(request.params.slotId);
  const slot = getSlotById(slotId);
  if (!slot) {
    response.status(404).json({ ok: false, error: "Unknown slot." });
    return;
  }

  const metadata = readSlotMetadata(slot.id);
  if (!metadata) {
    response.status(404).json({ ok: false, error: "No metadata for this slot." });
    return;
  }

  response.json(metadata);
});

app.post("/api/admin/slots/:slotId/stop", async (request, response) => {
  try {
    requireProvisionAuth(request);
    const slotId = Number(request.params.slotId);
    const slot = getSlotById(slotId);
    if (!slot) {
      response.status(404).json({ ok: false, error: "Unknown slot." });
      return;
    }

    const state = readSlotState(slot);
    if (state.state === "idle") {
      response.status(409).json({ ok: false, error: "Slot is already idle." });
      return;
    }

    await stopSlot(slotId);
    disconnectSlot(slotId);
    releaseSlot(slotId);
    response.json({ ok: true });
  } catch (error) {
    const status = error instanceof Error && error.message === "Unauthorized." ? 401 : 500;
    response.status(status).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/api/admin/slots/:slotId/start-manual", async (request, response) => {
  const bodySchema = z.object({
    map: z.string().trim().min(1),
    teamSize: z.number().int().min(1).max(8).default(4),
  });

  try {
    requireProvisionAuth(request);
    const slotId = Number(request.params.slotId);
    const slot = getSlotById(slotId);
    if (!slot) {
      response.status(404).json({ ok: false, error: "Unknown slot." });
      return;
    }

    const body = bodySchema.parse(request.body);
    const result = prepareManualSlot(slotId, body.map, body.teamSize);
    if (!result) {
      response.status(409).json({ ok: false, error: "Slot is not idle." });
      return;
    }

    await startSlot(slotId);
    connectSlot(slotId, slot.zmqPort);
    response.json({
      ok: true,
      joinAddress: `${config.publicIp}:${result.slot.gamePort}`,
      port: result.slot.gamePort,
    });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : error instanceof Error && error.message === "Unauthorized." ? 401 : 500;
    response.status(status).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.get("/api/admin/slots/:slotId/events", (request, response) => {
  try {
    requireProvisionAuth(request);
    const slotId = Number(request.params.slotId);
    const slot = getSlotById(slotId);
    if (!slot) {
      response.status(404).json({ ok: false, error: "Unknown slot." });
      return;
    }

    const since = typeof request.query.since === "string" ? request.query.since : undefined;
    const events = getSlotEvents(slotId, since);
    const players = getSlotPlayers(slotId);

    response.json({ ok: true, events, players });
  } catch (error) {
    const status = error instanceof Error && error.message === "Unauthorized." ? 401 : 500;
    response.status(status).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/api/admin/slots/:slotId/command", async (request, response) => {
  const bodySchema = z.object({
    action: z.enum(["kick", "ban", "say", "cmd"]),
    target: z.string().optional(),
    message: z.string().optional(),
  });

  try {
    requireProvisionAuth(request);
    const slotId = Number(request.params.slotId);
    const slot = getSlotById(slotId);
    if (!slot) {
      response.status(404).json({ ok: false, error: "Unknown slot." });
      return;
    }

    const state = readSlotState(slot);
    if (state.state === "idle" || !state.rconPort || !state.rconToken) {
      response.status(409).json({ ok: false, error: "Slot is not active or rcon is not available." });
      return;
    }

    const body = bodySchema.parse(request.body);
    const rconUrl = `http://127.0.0.1:${state.rconPort}/${body.action}`;
    const rconPayload: Record<string, string> = {};
    if (body.target) rconPayload.steamId = body.target;
    if (body.message) rconPayload.message = body.message;
    if (body.action === "cmd" && body.message) rconPayload.command = body.message;

    const rconResponse = await fetch(rconUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${state.rconToken}`,
      },
      body: JSON.stringify(rconPayload),
    });

    if (!rconResponse.ok) {
      const text = await rconResponse.text().catch(() => "Unknown error");
      response.status(502).json({ ok: false, error: `Rcon error: ${text}` });
      return;
    }

    const result = await rconResponse.json().catch(() => ({}));
    response.json({ ok: true, ...result });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : error instanceof Error && error.message === "Unauthorized." ? 401 : 500;
    response.status(status).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

ensureAppDirectories();
await reconcileSlots();
initializeZmqForActiveSlots();

app.listen(config.port, () => {
  console.log(`qltracker-provisioner listening on :${config.port}`);
});
