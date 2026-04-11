-- CreateTable
CREATE TABLE "PickupMatchEventRaw" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "eventIndex" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventAt" TIMESTAMP(3),
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PickupMatchEventRaw_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PickupMatchStatsSummary" (
    "matchId" TEXT NOT NULL,
    "sourceEventIndex" INTEGER,
    "gameType" TEXT,
    "factory" TEXT,
    "mapKey" TEXT,
    "roundsPlayed" INTEGER,
    "redRounds" INTEGER,
    "blueRounds" INTEGER,
    "matchDurationSeconds" INTEGER,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PickupMatchStatsSummary_pkey" PRIMARY KEY ("matchId")
);

-- CreateTable
CREATE TABLE "PickupPlayerMatchStat" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "team" "PickupTeamSide",
    "score" INTEGER,
    "kills" INTEGER,
    "deaths" INTEGER,
    "damageGiven" INTEGER,
    "damageTaken" INTEGER,
    "timeSeconds" INTEGER,
    "ping" INTEGER,
    "accuracy" DOUBLE PRECISION,
    "medals" JSONB,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PickupPlayerMatchStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PickupPlayerWeaponStat" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "weapon" TEXT NOT NULL,
    "shots" INTEGER,
    "hits" INTEGER,
    "accuracy" DOUBLE PRECISION,
    "kills" INTEGER,
    "deaths" INTEGER,
    "damage" INTEGER,
    "timeSeconds" INTEGER,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PickupPlayerWeaponStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PickupKillEvent" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "eventIndex" INTEGER NOT NULL,
    "killerPlayerId" TEXT,
    "killerSteamId" TEXT,
    "killerName" TEXT,
    "victimPlayerId" TEXT,
    "victimSteamId" TEXT,
    "victimName" TEXT,
    "weapon" TEXT,
    "mod" TEXT,
    "teamKill" BOOLEAN NOT NULL DEFAULT false,
    "suicide" BOOLEAN NOT NULL DEFAULT false,
    "occurredAt" TIMESTAMP(3),
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PickupKillEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PickupMatchEventRaw_matchId_eventIndex_key" ON "PickupMatchEventRaw"("matchId", "eventIndex");

-- CreateIndex
CREATE INDEX "PickupMatchEventRaw_matchId_createdAt_idx" ON "PickupMatchEventRaw"("matchId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PickupPlayerMatchStat_matchId_playerId_key" ON "PickupPlayerMatchStat"("matchId", "playerId");

-- CreateIndex
CREATE INDEX "PickupPlayerMatchStat_playerId_createdAt_idx" ON "PickupPlayerMatchStat"("playerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PickupPlayerWeaponStat_matchId_playerId_weapon_key" ON "PickupPlayerWeaponStat"("matchId", "playerId", "weapon");

-- CreateIndex
CREATE INDEX "PickupPlayerWeaponStat_playerId_createdAt_idx" ON "PickupPlayerWeaponStat"("playerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PickupKillEvent_matchId_eventIndex_key" ON "PickupKillEvent"("matchId", "eventIndex");

-- CreateIndex
CREATE INDEX "PickupKillEvent_matchId_createdAt_idx" ON "PickupKillEvent"("matchId", "createdAt");

-- CreateIndex
CREATE INDEX "PickupKillEvent_killerPlayerId_idx" ON "PickupKillEvent"("killerPlayerId");

-- CreateIndex
CREATE INDEX "PickupKillEvent_victimPlayerId_idx" ON "PickupKillEvent"("victimPlayerId");

-- AddForeignKey
ALTER TABLE "PickupMatchEventRaw" ADD CONSTRAINT "PickupMatchEventRaw_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "PickupMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupMatchStatsSummary" ADD CONSTRAINT "PickupMatchStatsSummary_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "PickupMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupPlayerMatchStat" ADD CONSTRAINT "PickupPlayerMatchStat_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "PickupMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupPlayerMatchStat" ADD CONSTRAINT "PickupPlayerMatchStat_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "PickupPlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupPlayerWeaponStat" ADD CONSTRAINT "PickupPlayerWeaponStat_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "PickupMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupPlayerWeaponStat" ADD CONSTRAINT "PickupPlayerWeaponStat_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "PickupPlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupKillEvent" ADD CONSTRAINT "PickupKillEvent_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "PickupMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupKillEvent" ADD CONSTRAINT "PickupKillEvent_killerPlayerId_fkey" FOREIGN KEY ("killerPlayerId") REFERENCES "PickupPlayer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupKillEvent" ADD CONSTRAINT "PickupKillEvent_victimPlayerId_fkey" FOREIGN KEY ("victimPlayerId") REFERENCES "PickupPlayer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
