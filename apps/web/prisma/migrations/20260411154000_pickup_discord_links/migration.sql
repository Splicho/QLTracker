CREATE TABLE "PickupDiscordLink" (
  "id" TEXT NOT NULL,
  "discordUserId" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PickupDiscordLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PickupDiscordLink_discordUserId_key" ON "PickupDiscordLink"("discordUserId");
CREATE INDEX "PickupDiscordLink_playerId_idx" ON "PickupDiscordLink"("playerId");

ALTER TABLE "PickupDiscordLink"
  ADD CONSTRAINT "PickupDiscordLink_playerId_fkey"
  FOREIGN KEY ("playerId") REFERENCES "PickupPlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
