-- Add player-driven substitute requests for pre-live pickup matches.

-- CreateEnum
CREATE TYPE "PickupMatchSubRequestStatus" AS ENUM (
    'pending',
    'accepted',
    'declined',
    'cancelled',
    'expired'
);

-- CreateEnum
CREATE TYPE "PickupMatchSubstitutionStage" AS ENUM (
    'veto',
    'server_ready'
);

-- CreateTable
CREATE TABLE "PickupMatchSubRequest" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "requesterPlayerId" TEXT NOT NULL,
    "targetPlayerId" TEXT NOT NULL,
    "status" "PickupMatchSubRequestStatus" NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PickupMatchSubRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PickupMatchSubstitution" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "outPlayerId" TEXT NOT NULL,
    "inPlayerId" TEXT NOT NULL,
    "acceptedRequestId" TEXT NOT NULL,
    "stage" "PickupMatchSubstitutionStage" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PickupMatchSubstitution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PickupMatchSubRequest_matchId_status_createdAt_idx"
ON "PickupMatchSubRequest"("matchId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "PickupMatchSubRequest_requesterPlayerId_status_createdAt_idx"
ON "PickupMatchSubRequest"("requesterPlayerId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "PickupMatchSubRequest_targetPlayerId_status_expiresAt_idx"
ON "PickupMatchSubRequest"("targetPlayerId", "status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PickupMatchSubstitution_acceptedRequestId_key"
ON "PickupMatchSubstitution"("acceptedRequestId");

-- CreateIndex
CREATE INDEX "PickupMatchSubstitution_matchId_createdAt_idx"
ON "PickupMatchSubstitution"("matchId", "createdAt");

-- CreateIndex
CREATE INDEX "PickupMatchSubstitution_outPlayerId_createdAt_idx"
ON "PickupMatchSubstitution"("outPlayerId", "createdAt");

-- CreateIndex
CREATE INDEX "PickupMatchSubstitution_inPlayerId_createdAt_idx"
ON "PickupMatchSubstitution"("inPlayerId", "createdAt");

-- AddForeignKey
ALTER TABLE "PickupMatchSubRequest"
ADD CONSTRAINT "PickupMatchSubRequest_matchId_fkey"
FOREIGN KEY ("matchId") REFERENCES "PickupMatch"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupMatchSubRequest"
ADD CONSTRAINT "PickupMatchSubRequest_requesterPlayerId_fkey"
FOREIGN KEY ("requesterPlayerId") REFERENCES "PickupPlayer"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupMatchSubRequest"
ADD CONSTRAINT "PickupMatchSubRequest_targetPlayerId_fkey"
FOREIGN KEY ("targetPlayerId") REFERENCES "PickupPlayer"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupMatchSubstitution"
ADD CONSTRAINT "PickupMatchSubstitution_matchId_fkey"
FOREIGN KEY ("matchId") REFERENCES "PickupMatch"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupMatchSubstitution"
ADD CONSTRAINT "PickupMatchSubstitution_outPlayerId_fkey"
FOREIGN KEY ("outPlayerId") REFERENCES "PickupPlayer"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupMatchSubstitution"
ADD CONSTRAINT "PickupMatchSubstitution_inPlayerId_fkey"
FOREIGN KEY ("inPlayerId") REFERENCES "PickupPlayer"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupMatchSubstitution"
ADD CONSTRAINT "PickupMatchSubstitution_acceptedRequestId_fkey"
FOREIGN KEY ("acceptedRequestId") REFERENCES "PickupMatchSubRequest"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
