-- AlterTable
ALTER TABLE "WorkOrder" ADD COLUMN     "roundId" TEXT;

-- CreateTable
CREATE TABLE "GuardRound" (
    "id" TEXT NOT NULL,
    "guardId" TEXT NOT NULL,
    "shift" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "checked" TEXT[],
    "notes" TEXT,

    CONSTRAINT "GuardRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeterReading" (
    "id" TEXT NOT NULL,
    "meter" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "takenBy" TEXT NOT NULL,
    "roundId" TEXT,

    CONSTRAINT "MeterReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "installedAt" TIMESTAMP(3) NOT NULL,
    "lifeMonths" INTEGER NOT NULL,
    "warrantyUntil" TIMESTAMP(3),
    "cost" DECIMAL(12,2) NOT NULL,
    "vendor" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OK',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockItem" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "uom" TEXT NOT NULL DEFAULT 'pc',
    "onHand" INTEGER NOT NULL DEFAULT 0,
    "reorderPoint" INTEGER NOT NULL,
    "reorderQty" INTEGER NOT NULL,
    "benchmark" DECIMAL(12,2) NOT NULL,
    "lastPrice" DECIMAL(12,2),

    CONSTRAINT "StockItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMove" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "ref" TEXT,
    "byName" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMove_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Replacement" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "itemId" TEXT,
    "workOrder" INTEGER,
    "doneAt" TIMESTAMP(3) NOT NULL,
    "doneBy" TEXT NOT NULL,
    "loggedBy" TEXT NOT NULL,
    "cost" DECIMAL(12,2) NOT NULL,
    "warrantyClaim" BOOLEAN NOT NULL DEFAULT false,
    "newWarrantyTil" TIMESTAMP(3),
    "oldPartReturned" BOOLEAN NOT NULL DEFAULT false,
    "photo" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Replacement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRequest" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "itemId" TEXT,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "reason" TEXT NOT NULL,
    "workOrder" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'QUOTING',
    "requestedBy" TEXT NOT NULL,
    "requester" TEXT NOT NULL,
    "approvals" JSONB NOT NULL DEFAULT '[]',
    "rejectNote" TEXT,
    "chosenQuote" TEXT,
    "chooseNote" TEXT,
    "poNumber" TEXT,
    "orderedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "receivedBy" TEXT,
    "receivedQty" INTEGER,
    "receivedNote" TEXT,
    "receivedPic" TEXT,
    "invoiceTotal" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "leadDays" INTEGER,
    "note" TEXT,
    "addedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GuardRound_startedAt_idx" ON "GuardRound"("startedAt");

-- CreateIndex
CREATE INDEX "MeterReading_meter_takenAt_idx" ON "MeterReading"("meter", "takenAt");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_tag_key" ON "Asset"("tag");

-- CreateIndex
CREATE UNIQUE INDEX "StockItem_sku_key" ON "StockItem"("sku");

-- CreateIndex
CREATE INDEX "StockMove_itemId_createdAt_idx" ON "StockMove"("itemId", "createdAt");

-- CreateIndex
CREATE INDEX "Replacement_assetId_doneAt_idx" ON "Replacement"("assetId", "doneAt");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseRequest_number_key" ON "PurchaseRequest"("number");

-- CreateIndex
CREATE INDEX "PurchaseRequest_status_idx" ON "PurchaseRequest"("status");

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "GuardRound"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardRound" ADD CONSTRAINT "GuardRound_guardId_fkey" FOREIGN KEY ("guardId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeterReading" ADD CONSTRAINT "MeterReading_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "GuardRound"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMove" ADD CONSTRAINT "StockMove_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "StockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Replacement" ADD CONSTRAINT "Replacement_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Replacement" ADD CONSTRAINT "Replacement_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "StockItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "StockItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "PurchaseRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
