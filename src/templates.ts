import path from "node:path";
import { config, type SlotDefinition } from "./config.js";
import type { ProvisionPayload, SlotMetadata } from "./types.js";

const PICKUP_WORKSHOP_IDS = [
  "1804795751",
  "1804815655",
  "3463480024",
  "2806460799",
] as const;

function formatQueueLabel(queueId: string, teamSize: number) {
  const normalized = queueId.trim().toLowerCase();

  if (normalized.includes("2v2") && normalized.includes("ca")) {
    return "2v2 CA";
  }

  if (normalized.includes("4v4") && normalized.includes("ca")) {
    return "4v4 CA";
  }

  const rawLabel = normalized.replace(/[-_]+/g, " ").trim();
  if (rawLabel.length === 0) {
    return `${teamSize}v${teamSize} CA`;
  }

  return rawLabel.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getMapPoolFile(teamSize: number) {
  if (teamSize <= 2) {
    return "mappool_capickup_2v2.txt";
  }

  return "mappool_capickup_4v4.txt";
}

export function buildSlotMetadata(
  payload: ProvisionPayload,
  slot: SlotDefinition,
  callbackToken: string,
): SlotMetadata {
  return {
    callbackBaseUrl: `http://127.0.0.1:${config.port}/internal/slots/${slot.id}`,
    callbackToken,
    captains: payload.captains,
    finalMapKey: payload.finalMapKey,
    matchId: payload.matchId,
    queueId: payload.queueId,
    seasonId: payload.seasonId,
    slotId: slot.id,
    teams: {
      blue: payload.teams.right.map((player) => ({ ...player })),
      red: payload.teams.left.map((player) => ({ ...player })),
    },
  };
}

export function buildSlotEnv(slotDir: string, slot: SlotDefinition) {
  return [
    `QLDS_BASE_DIR=${config.qldsBaseDir}`,
    `PUBLIC_IP=${config.publicIp}`,
    `SLOT_ID=${slot.id}`,
    `GAME_PORT=${slot.gamePort}`,
    `ZMQ_PORT=${slot.zmqPort}`,
    `SLOT_DIR=${slotDir}`,
    `SERVER_CFG=pickup-server.cfg`,
    `FS_HOMEPATH=${path.join(slotDir, "home")}`,
    `LOG_DIR=${path.join(slotDir, "logs")}`,
  ].join("\n");
}

export function buildServerCfg(
  slotDir: string,
  slot: SlotDefinition,
  metadata: SlotMetadata,
) {
  const teamSize = metadata.teams.red.length;
  const maxClients = teamSize * 2 + 2;
  const metadataFile = path.join(slotDir, "match.json");
  const queueLabel = formatQueueLabel(metadata.queueId, teamSize);

  return [
    `set sv_hostname "^1QLTracker^7 Pickup | ${queueLabel}"`,
    `set teamsize "${teamSize}"`,
    `set sv_maxclients "${maxClients}"`,
    `set sv_mapPoolFile "${getMapPoolFile(teamSize)}"`,
    `set qlx_owner "${config.qlxOwnerSteamId}"`,
    `set qlx_plugins "plugin_manager,essentials,workshop,pickup_bridge,qltracker_sort,qltracker_admins"`,
    `set qlx_database "Redis"`,
    `set qlx_redisAddress "127.0.0.1"`,
    `set qlx_redisDatabase "${slot.redisDb}"`,
    `set qlx_logs "5"`,
    `set qlx_workshopReferences "${PICKUP_WORKSHOP_IDS.join(",")}"`,
    `set zmq_stats_enable "1"`,
    `set zmq_stats_ip "127.0.0.1"`,
    `set zmq_stats_port "${slot.zmqPort}"`,
    `set qlx_pickupMetadataFile "${metadataFile}"`,
    `set qlx_pickupBridgeUrl "${metadata.callbackBaseUrl}"`,
    `set qlx_pickupBridgeToken "${metadata.callbackToken}"`,
    `set serverstartup "map ${metadata.finalMapKey} hoq_ca"`,
  ].join("\n");
}

export function buildManualServerCfg(
  slotDir: string,
  slot: SlotDefinition,
  map: string,
) {
  return [
    `set sv_hostname "^1QLTracker^7 Manual Server"`,
    `set teamsize "4"`,
    `set sv_maxclients "10"`,
    `set sv_mapPoolFile "mappool_capickup_4v4.txt"`,
    `set qlx_owner "${config.qlxOwnerSteamId}"`,
    `set qlx_plugins "plugin_manager,essentials,workshop,qltracker_admins"`,
    `set qlx_database "Redis"`,
    `set qlx_redisAddress "127.0.0.1"`,
    `set qlx_redisDatabase "${slot.redisDb}"`,
    `set qlx_logs "5"`,
    `set qlx_workshopReferences "${PICKUP_WORKSHOP_IDS.join(",")}"`,
    `set zmq_stats_enable "1"`,
    `set zmq_stats_ip "127.0.0.1"`,
    `set zmq_stats_port "${slot.zmqPort}"`,
    `set serverstartup "map ${map} hoq_ca"`,
  ].join("\n");
}
