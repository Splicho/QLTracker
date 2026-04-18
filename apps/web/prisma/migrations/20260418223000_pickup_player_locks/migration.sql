-- CreateTable
CREATE TABLE "PickupPlayerLock" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "reason" TEXT,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdBySteamId" TEXT,
    "revokedBySteamId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PickupPlayerLock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PickupPlayerLock_playerId_revokedAt_expiresAt_idx" ON "PickupPlayerLock"("playerId", "revokedAt", "expiresAt");

-- CreateIndex
CREATE INDEX "PickupPlayerLock_createdAt_idx" ON "PickupPlayerLock"("createdAt");

-- AddForeignKey
ALTER TABLE "PickupPlayerLock" ADD CONSTRAINT "PickupPlayerLock_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "PickupPlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
