import zmq from "zeromq";
import { SLOT_DEFINITIONS } from "./config.js";
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
  events: SlotEvent[];
  players: Map<string, SlotPlayer>;
  socket: zmq.Socket | null;
};

const MAX_EVENTS = 500;
const slotBuffers = new Map<number, SlotBuffer>();

function createBuffer(): SlotBuffer {
  return {
    events: [],
    players: new Map(),
    socket: null,
  };
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

function handleZmqMessage(slotId: number, raw: Buffer) {
  const buffer = slotBuffers.get(slotId);
  if (!buffer) return;

  try {
    const msg = JSON.parse(raw.toString("utf8")) as { TYPE?: string; DATA?: Record<string, unknown> };
    const type = msg.TYPE ?? "UNKNOWN";
    const data = msg.DATA ?? {};

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
        const steamId = String((data.PLAYER as Record<string, unknown>)?.STEAM_ID ?? data.STEAM_ID ?? "");
        const team = String((data.PLAYER as Record<string, unknown>)?.TEAM ?? data.TEAM ?? "spectator");
        const existing = steamId ? buffer.players.get(steamId) : undefined;
        if (existing) {
          existing.team = team;
        }
        break;
      }

      case "MATCH_STARTED": {
        // Reset player list on new match - players will reconnect
        break;
      }

      default:
        break;
    }

    pushEvent(buffer, type, data);
  } catch {
    // Ignore unparseable messages
  }
}

export function connectSlot(slotId: number, zmqPort: number) {
  disconnectSlot(slotId);

  const buffer = createBuffer();
  const socket = zmq.socket("sub");

  socket.connect(`tcp://127.0.0.1:${zmqPort}`);
  socket.subscribe("");

  socket.on("message", (data: Buffer) => {
    handleZmqMessage(slotId, data);
  });

  socket.on("error", (error: Error) => {
    console.error(`[zmq] slot ${slotId} error:`, error.message);
  });

  buffer.socket = socket;
  slotBuffers.set(slotId, buffer);
  console.info(`[zmq] connected to slot ${slotId} on port ${zmqPort}`);
}

export function disconnectSlot(slotId: number) {
  const buffer = slotBuffers.get(slotId);
  if (!buffer) return;

  if (buffer.socket) {
    try {
      buffer.socket.close();
    } catch {
      // Ignore close errors
    }
  }

  slotBuffers.delete(slotId);
  console.info(`[zmq] disconnected from slot ${slotId}`);
}

export function getSlotEvents(slotId: number, since?: string): SlotEvent[] {
  const buffer = slotBuffers.get(slotId);
  if (!buffer) return [];

  if (!since) return buffer.events;

  return buffer.events.filter((event) => event.timestamp > since);
}

export function getSlotPlayers(slotId: number): SlotPlayer[] {
  const buffer = slotBuffers.get(slotId);
  if (!buffer) return [];

  return Array.from(buffer.players.values());
}

export function initializeZmqForActiveSlots() {
  for (const slot of SLOT_DEFINITIONS) {
    const state = readSlotState(slot);
    if (state.state !== "idle") {
      connectSlot(slot.id, slot.zmqPort);
    }
  }
}
