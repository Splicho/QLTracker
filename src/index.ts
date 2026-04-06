import crypto from "node:crypto";
import express from "express";
import { z } from "zod";
import { config, ensureAppDirectories, SLOT_DEFINITIONS } from "./config.js";
import { createSignature } from "./signing.js";
import {
  allocateSlot,
  markSlotReady,
  readSlotMetadata,
  readSlotState,
  reconcileSlots,
  releaseSlot,
  startSlot,
  stopSlot,
} from "./slots.js";
import { provisionPayloadSchema } from "./types.js";

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

async function postMatchResult(matchId: string, winnerTeam: "left" | "right", finalScore: string | null) {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const payload = {
        finalScore,
        matchId,
        winnerTeam,
      };
      const rawBody = JSON.stringify(payload);
      const response = await fetch(config.realtimeResultCallbackUrl, {
        body: rawBody,
        headers: {
          "Content-Type": "application/json",
          "x-pickup-signature": createSignature(config.callbackSecret, rawBody),
        },
        method: "POST",
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Realtime result callback failed (${response.status}): ${text}`);
      }

      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < 5) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 2_000));
      }
    }
  }

  throw lastError ?? new Error("Realtime result callback failed.");
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
      await waitForReady(allocation.slot.id);
      response.json({
        ip: config.publicIp,
        joinAddress: `${config.publicIp}:${allocation.slot.gamePort}`,
        port: allocation.slot.gamePort,
      });
    } catch (error) {
      rejectReady(allocation.slot.id, error instanceof Error ? error : new Error(String(error)));
      await stopSlot(allocation.slot.id);
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

    markSlotReady(slotId);
    resolveReady(slotId);
    response.json({ ok: true });
  } catch (error) {
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
    response.json({ ok: true });

    setTimeout(async () => {
      await stopSlot(slotId);
      releaseSlot(slotId);
    }, config.postMatchGraceSeconds * 1000);
  } catch (error) {
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

ensureAppDirectories();
await reconcileSlots();

app.listen(config.port, () => {
  console.log(`qltracker-provisioner listening on :${config.port}`);
});
