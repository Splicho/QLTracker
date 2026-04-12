import path from "node:path";
import { config, type SlotDefinition } from "./config.js";
import type { ProvisionPayload, SlotMetadata } from "./types.js";

const PICKUP_WORKSHOP_IDS = [
  "1804795751",
  "1804815655",
  "3463480024",
  "3444408828",
  "3463000025",
  "2806460799",
  "3694724670",
  "3146629108",
  "3008771992",
  "3008846662",
  "3287948013",
  "3460015022",
] as const;

function formatQueueLabel(queueId: string, teamSize: number) {
  const normalized = queueId.trim().toLowerCase();

  if (normalized.includes("1v1") && normalized.includes("ca")) {
    return "1v1 CA";
  }

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
  if (teamSize <= 1) {
    return "mappool_capickup_1v1.txt";
  }

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
    queue: payload.queue,
    queueId: payload.queueId,
    ratings: payload.ratings?.map((player) => ({ ...player })),
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
    `ZMQ_STATS_ENABLE=1`,
    `ZMQ_STATS_IP=127.0.0.1`,
    `ZMQ_STATS_PORT=${slot.zmqPort}`,
    `ZMQ_STATS_PASSWORD=${config.zmqStatsPassword ?? ""}`,
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
  rconPort: number,
  rconToken: string,
) {
  const teamSize = metadata.teams.red.length;
  const maxClients = teamSize * 2 + 2;
  const metadataFile = path.join(slotDir, "match.json");
  const queueLabel = formatQueueLabel(metadata.queueId, teamSize);
  const pickupBrandName = `^1QLTracker^7 Pickup`;

  return [
    `set sv_hostname "QLTracker Pickup | discord.gg/qltracker"`,
    `set teamsize "${teamSize}"`,
    `set sv_maxclients "${maxClients}"`,
    `set sv_mapPoolFile "${getMapPoolFile(teamSize)}"`,
    `set g_voteFlags "2056"`,
    `set qlx_owner "${config.qlxOwnerSteamId}"`,
    `set qlx_plugins "plugin_manager,essentials,ban,permission,workshop,branding,pickup_bridge,qltracker_stats_bridge,qltracker_sort,qltracker_ratings,qltracker_admins,qltracker_rcon"`,
    `set qlx_database "Redis"`,
    `set qlx_redisAddress "127.0.0.1"`,
    `set qlx_redisDatabase "${slot.redisDb}"`,
    `set qlx_logs "5"`,
    `set qlx_workshopReferences "${PICKUP_WORKSHOP_IDS.join(",")}"`,
    `set qlx_serverBrandName "${pickupBrandName}"`,
    `set qlx_serverBrandTopField "${queueLabel}"`,
    `set qlx_serverBrandBottomField "^7Hosted by ^1QLTracker"`,
    `set qlx_rconPort "${rconPort}"`,
    `set qlx_rconToken "${rconToken}"`,
    `set qlx_pickupMetadataFile "${metadataFile}"`,
    `set qlx_pickupBridgeUrl "${metadata.callbackBaseUrl}"`,
    `set qlx_pickupBridgeToken "${metadata.callbackToken}"`,
    `set qlx_pickupMatchId "${metadata.matchId}"`,
    `set qlx_pickupStatsUrl "${metadata.callbackBaseUrl}/stats-supplemental"`,
    `mappool_reload`,
    `set serverstartup "map ${metadata.finalMapKey} hoq_ca"`,
  ].join("\n");
}

export function buildManualServerCfg(
  slotDir: string,
  slot: SlotDefinition,
  map: string,
  teamSize: number,
  rconPort: number,
  rconToken: string,
) {
  const maxClients = teamSize * 2 + 2;
  const manualLabel = `${teamSize}v${teamSize} CA`;
  const manualBrandName = "^1QLTracker^7 | Clan Arena";

  return [
    `set sv_hostname "QLTracker | discord.gg/qltracker"`,
    `set teamsize "${teamSize}"`,
    `set sv_maxclients "${maxClients}"`,
    `set sv_mapPoolFile "${getMapPoolFile(teamSize)}"`,
    `set qlx_owner "${config.qlxOwnerSteamId}"`,
    `set qlx_plugins "plugin_manager,essentials,ban,permission,workshop,branding,qltracker_admins,qltracker_rcon"`,
    `set qlx_database "Redis"`,
    `set qlx_redisAddress "127.0.0.1"`,
    `set qlx_redisDatabase "${slot.redisDb}"`,
    `set qlx_logs "5"`,
    `set qlx_workshopReferences "${PICKUP_WORKSHOP_IDS.join(",")}"`,
    `set qlx_serverBrandName "${manualBrandName}"`,
    `set qlx_serverBrandTopField "${manualLabel}"`,
    `set qlx_serverBrandBottomField "^7Hosted by ^1QLTracker"`,
    `set qlx_rconPort "${rconPort}"`,
    `set qlx_rconToken "${rconToken}"`,
    `set serverstartup "map ${map} hoq_ca"`,
    `map ${map} hoq_ca`,
  ].join("\n");
}
