-- AlterEnum
ALTER TYPE "ThresholdMode" ADD VALUE 'active_free_slots';

-- AlterTable
ALTER TABLE "NotificationRule"
ADD COLUMN "matchCapacity" INTEGER;

-- AlterTable
ALTER TABLE "NotificationDelivery"
ADD COLUMN "activePlayers" INTEGER,
ADD COLUMN "matchCapacity" INTEGER;
