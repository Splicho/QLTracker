CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- CreateEnum
CREATE TYPE "PickupLinkSessionStatus" AS ENUM ('pending', 'complete', 'expired', 'error');

-- CreateEnum
CREATE TYPE "PickupLinkSessionFlow" AS ENUM ('launcher', 'browser');

-- CreateEnum
CREATE TYPE "PickupSeasonStatus" AS ENUM ('draft', 'active', 'completed');

-- CreateEnum
CREATE TYPE "PickupSeasonDurationPreset" AS ENUM ('one_month', 'three_month', 'custom');

-- CreateEnum
CREATE TYPE "PickupMatchStatus" AS ENUM (
  'ready_check',
  'veto',
  'provisioning',
  'server_ready',
  'live',
  'completed',
  'cancelled'
);

-- CreateEnum
CREATE TYPE "PickupReadyState" AS ENUM ('pending', 'ready', 'dropped');

-- CreateEnum
CREATE TYPE "PickupTeamSide" AS ENUM ('left', 'right');

-- CreateTable
CREATE TABLE "PickupPlayer" (
  "id" TEXT NOT NULL,
  "steamId" TEXT NOT NULL,
  "personaName" TEXT NOT NULL,
  "avatarUrl" TEXT,
  "profileUrl" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastLoginAt" TIMESTAMPTZ,
  CONSTRAINT "PickupPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PickupAppSession" (
  "id" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "revokedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" TIMESTAMPTZ,
  CONSTRAINT "PickupAppSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PickupLinkSession" (
  "id" TEXT NOT NULL,
  "oauthState" TEXT NOT NULL,
  "flow" "PickupLinkSessionFlow" NOT NULL DEFAULT 'launcher',
  "status" "PickupLinkSessionStatus" NOT NULL DEFAULT 'pending',
  "redirectPath" TEXT,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "appSessionToken" TEXT,
  "errorMessage" TEXT,
  "completedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "playerId" TEXT,
  CONSTRAINT "PickupLinkSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PickupQueue" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "teamSize" INTEGER NOT NULL DEFAULT 4,
  "playerCount" INTEGER NOT NULL DEFAULT 8,
  "readyCheckDurationSeconds" INTEGER NOT NULL DEFAULT 30,
  "vetoTurnDurationSeconds" INTEGER NOT NULL DEFAULT 20,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "provisionApiUrl" TEXT,
  "provisionAuthToken" TEXT,
  "callbackSecret" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PickupQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PickupSeason" (
  "id" TEXT NOT NULL,
  "queueId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" "PickupSeasonStatus" NOT NULL DEFAULT 'draft',
  "durationPreset" "PickupSeasonDurationPreset" NOT NULL DEFAULT 'custom',
  "startsAt" TIMESTAMPTZ NOT NULL,
  "endsAt" TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PickupSeason_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PickupMapPool" (
  "id" TEXT NOT NULL,
  "queueId" TEXT NOT NULL,
  "mapKey" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PickupMapPool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PickupQueueMember" (
  "id" TEXT NOT NULL,
  "queueId" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "joinedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PickupQueueMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PickupMatch" (
  "id" TEXT NOT NULL,
  "queueId" TEXT NOT NULL,
  "seasonId" TEXT NOT NULL,
  "status" "PickupMatchStatus" NOT NULL DEFAULT 'ready_check',
  "readyDeadlineAt" TIMESTAMPTZ,
  "vetoDeadlineAt" TIMESTAMPTZ,
  "currentCaptainPlayerId" TEXT,
  "finalMapKey" TEXT,
  "bannedMapKeys" JSONB,
  "vetoState" JSONB,
  "balanceSummary" JSONB,
  "provisionPayload" JSONB,
  "resultPayload" JSONB,
  "serverIp" TEXT,
  "serverPort" INTEGER,
  "serverJoinAddress" TEXT,
  "serverLocationCountryCode" TEXT,
  "serverLocationCountryName" TEXT,
  "serverProvisionedAt" TIMESTAMPTZ,
  "liveStartedAt" TIMESTAMPTZ,
  "completedAt" TIMESTAMPTZ,
  "winnerTeam" "PickupTeamSide",
  "finalScore" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PickupMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PickupMatchPlayer" (
  "id" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "joinedAt" TIMESTAMPTZ NOT NULL,
  "readyState" "PickupReadyState" NOT NULL DEFAULT 'pending',
  "readyConfirmedAt" TIMESTAMPTZ,
  "team" "PickupTeamSide",
  "isCaptain" BOOLEAN NOT NULL DEFAULT false,
  "muBefore" DOUBLE PRECISION NOT NULL,
  "sigmaBefore" DOUBLE PRECISION NOT NULL,
  "displayBefore" INTEGER NOT NULL,
  "muAfter" DOUBLE PRECISION,
  "sigmaAfter" DOUBLE PRECISION,
  "displayAfter" INTEGER,
  "won" BOOLEAN,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PickupMatchPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PickupPlayerSeasonRating" (
  "id" TEXT NOT NULL,
  "seasonId" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "mu" DOUBLE PRECISION NOT NULL,
  "sigma" DOUBLE PRECISION NOT NULL,
  "displayRating" INTEGER NOT NULL,
  "gamesPlayed" INTEGER NOT NULL DEFAULT 0,
  "wins" INTEGER NOT NULL DEFAULT 0,
  "losses" INTEGER NOT NULL DEFAULT 0,
  "seededFrom" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PickupPlayerSeasonRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PickupProvisionEvent" (
  "id" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PickupProvisionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PickupPlayer_steamId_key" ON "PickupPlayer"("steamId");
CREATE UNIQUE INDEX "PickupAppSession_tokenHash_key" ON "PickupAppSession"("tokenHash");
CREATE INDEX "PickupAppSession_playerId_idx" ON "PickupAppSession"("playerId");
CREATE UNIQUE INDEX "PickupLinkSession_oauthState_key" ON "PickupLinkSession"("oauthState");
CREATE INDEX "PickupLinkSession_status_idx" ON "PickupLinkSession"("status");
CREATE INDEX "PickupLinkSession_flow_idx" ON "PickupLinkSession"("flow");
CREATE UNIQUE INDEX "PickupQueue_slug_key" ON "PickupQueue"("slug");
CREATE INDEX "PickupSeason_queueId_status_idx" ON "PickupSeason"("queueId", "status");
CREATE INDEX "PickupSeason_startsAt_endsAt_idx" ON "PickupSeason"("startsAt", "endsAt");
CREATE UNIQUE INDEX "PickupMapPool_queueId_mapKey_key" ON "PickupMapPool"("queueId", "mapKey");
CREATE UNIQUE INDEX "PickupQueueMember_playerId_key" ON "PickupQueueMember"("playerId");
CREATE UNIQUE INDEX "PickupQueueMember_queueId_playerId_key" ON "PickupQueueMember"("queueId", "playerId");
CREATE INDEX "PickupQueueMember_queueId_joinedAt_idx" ON "PickupQueueMember"("queueId", "joinedAt");
CREATE INDEX "PickupMatch_queueId_status_idx" ON "PickupMatch"("queueId", "status");
CREATE INDEX "PickupMatch_seasonId_status_idx" ON "PickupMatch"("seasonId", "status");
CREATE UNIQUE INDEX "PickupMatchPlayer_matchId_playerId_key" ON "PickupMatchPlayer"("matchId", "playerId");
CREATE INDEX "PickupMatchPlayer_playerId_createdAt_idx" ON "PickupMatchPlayer"("playerId", "createdAt");
CREATE UNIQUE INDEX "PickupPlayerSeasonRating_seasonId_playerId_key" ON "PickupPlayerSeasonRating"("seasonId", "playerId");
CREATE INDEX "PickupPlayerSeasonRating_seasonId_displayRating_idx" ON "PickupPlayerSeasonRating"("seasonId", "displayRating");
CREATE INDEX "PickupProvisionEvent_matchId_createdAt_idx" ON "PickupProvisionEvent"("matchId", "createdAt");

-- AddForeignKey
ALTER TABLE "PickupAppSession"
  ADD CONSTRAINT "PickupAppSession_playerId_fkey"
  FOREIGN KEY ("playerId") REFERENCES "PickupPlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PickupLinkSession"
  ADD CONSTRAINT "PickupLinkSession_playerId_fkey"
  FOREIGN KEY ("playerId") REFERENCES "PickupPlayer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PickupSeason"
  ADD CONSTRAINT "PickupSeason_queueId_fkey"
  FOREIGN KEY ("queueId") REFERENCES "PickupQueue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PickupMapPool"
  ADD CONSTRAINT "PickupMapPool_queueId_fkey"
  FOREIGN KEY ("queueId") REFERENCES "PickupQueue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PickupQueueMember"
  ADD CONSTRAINT "PickupQueueMember_queueId_fkey"
  FOREIGN KEY ("queueId") REFERENCES "PickupQueue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PickupQueueMember"
  ADD CONSTRAINT "PickupQueueMember_playerId_fkey"
  FOREIGN KEY ("playerId") REFERENCES "PickupPlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PickupMatch"
  ADD CONSTRAINT "PickupMatch_queueId_fkey"
  FOREIGN KEY ("queueId") REFERENCES "PickupQueue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PickupMatch"
  ADD CONSTRAINT "PickupMatch_seasonId_fkey"
  FOREIGN KEY ("seasonId") REFERENCES "PickupSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PickupMatchPlayer"
  ADD CONSTRAINT "PickupMatchPlayer_matchId_fkey"
  FOREIGN KEY ("matchId") REFERENCES "PickupMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PickupMatchPlayer"
  ADD CONSTRAINT "PickupMatchPlayer_playerId_fkey"
  FOREIGN KEY ("playerId") REFERENCES "PickupPlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PickupPlayerSeasonRating"
  ADD CONSTRAINT "PickupPlayerSeasonRating_playerId_fkey"
  FOREIGN KEY ("playerId") REFERENCES "PickupPlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PickupPlayerSeasonRating"
  ADD CONSTRAINT "PickupPlayerSeasonRating_seasonId_fkey"
  FOREIGN KEY ("seasonId") REFERENCES "PickupSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PickupProvisionEvent"
  ADD CONSTRAINT "PickupProvisionEvent_matchId_fkey"
  FOREIGN KEY ("matchId") REFERENCES "PickupMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
