-- CreateTable
CREATE TABLE "PickupMatchChatEvent" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "playerId" TEXT,
    "steamId" TEXT,
    "personaName" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PickupMatchChatEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PickupMatchChatEvent_matchId_sentAt_idx" ON "PickupMatchChatEvent"("matchId", "sentAt");

-- CreateIndex
CREATE INDEX "PickupMatchChatEvent_playerId_sentAt_idx" ON "PickupMatchChatEvent"("playerId", "sentAt");

-- CreateIndex
CREATE INDEX "PickupMatchChatEvent_steamId_sentAt_idx" ON "PickupMatchChatEvent"("steamId", "sentAt");

-- AddForeignKey
ALTER TABLE "PickupMatchChatEvent" ADD CONSTRAINT "PickupMatchChatEvent_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "PickupMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupMatchChatEvent" ADD CONSTRAINT "PickupMatchChatEvent_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "PickupPlayer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
