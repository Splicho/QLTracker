import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { config, SLOT_DEFINITIONS, type SlotDefinition } from "./config.js";
import { randomToken } from "./signing.js";
import { buildManualServerCfg, buildServerCfg, buildSlotEnv, buildSlotMetadata } from "./templates.js";
import type { ProvisionPayload, SlotMetadata, SlotState } from "./types.js";

const execFileAsync = promisify(execFile);

function slotDir(slotId: number) {
  return path.join(config.slotsDir, `slot-${slotId}`);
}

function stateFile(slotId: number) {
  return path.join(slotDir(slotId), "state.json");
}

function metadataFile(slotId: number) {
  return path.join(slotDir(slotId), "match.json");
}

export const RCON_BASE_PORT = 19000;

function clearSlotMetadata(slotId: number) {
  fs.rmSync(metadataFile(slotId), { force: true });
}

function defaultSlotState(slot: SlotDefinition): SlotState {
  return {
    gamePort: slot.gamePort,
    joinAddress: `${config.publicIp}:${slot.gamePort}`,
    matchId: null,
    queueId: null,
    rconPort: null,
    rconToken: null,
    redisDb: slot.redisDb,
    resultPostedAt: null,
    slotId: slot.id,
    state: "idle",
    token: null,
    updatedAt: new Date().toISOString(),
    zmqPort: slot.zmqPort,
  };
}

export async function systemctl(args: string[]) {
  return execFileAsync("sudo", ["systemctl", ...args]);
}

export async function getServiceState(slotId: number) {
  try {
    const { stdout } = await systemctl([
      "show",
      `qltracker-ql@${slotId}.service`,
      "--property=ActiveState",
      "--value",
    ]);
    return stdout.trim();
  } catch {
    return "inactive";
  }
}

export function readSlotState(slot: SlotDefinition): SlotState {
  const file = stateFile(slot.id);
  if (!fs.existsSync(file)) {
    const state = defaultSlotState(slot);
    writeSlotState(slot.id, state);
    return state;
  }

  const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as SlotState;
  const {
    gamePort: _gamePort,
    joinAddress: _joinAddress,
    redisDb: _redisDb,
    slotId: _slotId,
    zmqPort: _zmqPort,
    ...rest
  } = parsed;

  return {
    ...defaultSlotState(slot),
    ...rest,
  };
}

export function writeSlotState(slotId: number, state: SlotState) {
  fs.writeFileSync(stateFile(slotId), `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export function readSlotMetadata(slotId: number) {
  const file = metadataFile(slotId);
  if (!fs.existsSync(file)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(file, "utf8")) as SlotMetadata;
}

export async function reconcileSlots() {
  for (const slot of SLOT_DEFINITIONS) {
    const state = readSlotState(slot);
    const serviceState = await getServiceState(slot.id);
    const serviceRunning =
      serviceState === "active" ||
      serviceState === "activating" ||
      serviceState === "deactivating";

    if (state.state === "idle" && !serviceRunning) {
      clearSlotMetadata(slot.id);
      continue;
    }

    if (state.state === "idle" && serviceRunning) {
      clearSlotMetadata(slot.id);
      writeSlotState(slot.id, {
        ...state,
        matchId: null,
        queueId: null,
        state: "idle",
        token: null,
        updatedAt: new Date().toISOString(),
      });
      continue;
    }

    if (state.state !== "idle" && !serviceRunning) {
      clearSlotMetadata(slot.id);
      writeSlotState(slot.id, {
        ...state,
        matchId: null,
        queueId: null,
        state: "idle",
        token: null,
        updatedAt: new Date().toISOString(),
      });
    }
  }
}

export async function allocateSlot(payload: ProvisionPayload) {
  await reconcileSlots();

  for (const slot of SLOT_DEFINITIONS) {
    const state = readSlotState(slot);
    if (state.state !== "idle") {
      continue;
    }

    const token = randomToken();
    const rconToken = randomToken();
    const rconPort = RCON_BASE_PORT + slot.id;
    const currentDir = slotDir(slot.id);
    const metadata = buildSlotMetadata(payload, slot, token);
    fs.writeFileSync(metadataFile(slot.id), `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
    fs.writeFileSync(
      path.join(currentDir, "home", "baseq3", "pickup-server.cfg"),
      `${buildServerCfg(currentDir, slot, metadata, rconPort, rconToken)}\n`,
      "utf8",
    );
    fs.writeFileSync(path.join(currentDir, "slot.env"), `${buildSlotEnv(currentDir, slot)}\n`, "utf8");

    const nextState: SlotState = {
      ...state,
      matchId: payload.matchId,
      queueId: payload.queueId,
      rconPort,
      rconToken,
      resultPostedAt: null,
      state: "provisioning",
      token,
      updatedAt: new Date().toISOString(),
    };
    writeSlotState(slot.id, nextState);
    return { metadata, rconPort, rconToken, slot, state: nextState };
  }

  return null;
}

export async function startSlot(slotId: number) {
  await systemctl(["start", `qltracker-ql@${slotId}.service`]);
}

export async function stopSlot(slotId: number) {
  try {
    await systemctl(["stop", `qltracker-ql@${slotId}.service`]);
  } catch {
    // Stop is best effort.
  }
}

export function markSlotReady(slotId: number) {
  const slot = SLOT_DEFINITIONS.find((value) => value.id === slotId);
  if (!slot) {
    return null;
  }

  const state = readSlotState(slot);
  const nextState: SlotState = {
    ...state,
    state: "busy",
    updatedAt: new Date().toISOString(),
  };
  writeSlotState(slotId, nextState);
  return nextState;
}

export function markSlotResultPosted(slotId: number) {
  const slot = SLOT_DEFINITIONS.find((value) => value.id === slotId);
  if (!slot) {
    return null;
  }

  const state = readSlotState(slot);
  const now = new Date().toISOString();
  const nextState: SlotState = {
    ...state,
    resultPostedAt: now,
    updatedAt: now,
  };
  writeSlotState(slotId, nextState);
  return nextState;
}

export function releaseSlot(slotId: number) {
  const slot = SLOT_DEFINITIONS.find((value) => value.id === slotId);
  if (!slot) {
    return;
  }

  clearSlotMetadata(slotId);
  writeSlotState(slotId, defaultSlotState(slot));
}

export function prepareManualSlot(slotId: number, map: string, teamSize = 4) {
  const slot = SLOT_DEFINITIONS.find((value) => value.id === slotId);
  if (!slot) {
    return null;
  }

  const state = readSlotState(slot);
  if (state.state !== "idle") {
    return null;
  }

  const rconToken = randomToken();
  const rconPort = RCON_BASE_PORT + slot.id;
  const currentDir = slotDir(slot.id);
  clearSlotMetadata(slotId);
  fs.writeFileSync(
    path.join(currentDir, "home", "baseq3", "pickup-server.cfg"),
    `${buildManualServerCfg(currentDir, slot, map, teamSize, rconPort, rconToken)}\n`,
    "utf8",
  );
  fs.writeFileSync(path.join(currentDir, "slot.env"), `${buildSlotEnv(currentDir, slot)}\n`, "utf8");

  const nextState: SlotState = {
    ...state,
    matchId: `manual-${Date.now()}`,
    queueId: null,
    rconPort,
    rconToken,
    resultPostedAt: null,
    state: "busy",
    token: null,
    updatedAt: new Date().toISOString(),
  };
  writeSlotState(slotId, nextState);
  return { slot, state: nextState };
}
