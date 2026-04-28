-- Add per-player ready-check deadlines.

ALTER TABLE "PickupMatchPlayer"
ADD COLUMN "readyDeadlineAt" TIMESTAMP(3);
