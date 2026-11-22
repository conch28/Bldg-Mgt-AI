-- AlterTable
ALTER TABLE "PurchaseRequest" ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "paidBy" TEXT,
ADD COLUMN     "paidRef" TEXT,
ADD COLUMN     "receiptPic" TEXT,
ADD COLUMN     "submittedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "WorkOrder" ADD COLUMN     "ackAt" TIMESTAMP(3),
ADD COLUMN     "ackBy" TEXT,
ADD COLUMN     "doneBy" TEXT,
ADD COLUMN     "doneNote" TEXT,
ADD COLUMN     "donePhoto" TEXT,
ADD COLUMN     "jobToken" TEXT,
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedBy" TEXT;

-- CreateTable
CREATE TABLE "DutyNudge" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "sentTo" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DutyNudge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DutyNudge_key_level_key" ON "DutyNudge"("key", "level");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrder_jobToken_key" ON "WorkOrder"("jobToken");

