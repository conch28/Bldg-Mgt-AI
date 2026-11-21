-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "price" DECIMAL(14,2) NOT NULL,
    "suggestedLow" DECIMAL(14,2) NOT NULL,
    "suggestedHigh" DECIMAL(14,2) NOT NULL,
    "beds" INTEGER NOT NULL,
    "furnished" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "bodyTl" TEXT,
    "highlights" TEXT[],
    "rationale" TEXT NOT NULL,
    "channels" TEXT[],
    "posts" JSONB,
    "views" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closedPrice" DECIMAL(14,2),
    "broker" TEXT,
    "ai" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inquiry" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "aiReply" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "viewingAt" TIMESTAMP(3),
    "passCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Inquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketComp" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "building" TEXT NOT NULL,
    "distanceKm" DOUBLE PRECISION NOT NULL,
    "sqm" DECIMAL(8,2) NOT NULL,
    "beds" INTEGER NOT NULL,
    "floor" INTEGER,
    "furnished" TEXT,
    "price" DECIMAL(14,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketComp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lease" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "tenantName" TEXT NOT NULL,
    "rent" DECIMAL(12,2) NOT NULL,
    "deposit" DECIMAL(12,2) NOT NULL,
    "start" TIMESTAMP(3) NOT NULL,
    "end" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MoveRequest" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "done" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "passCode" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MoveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UtilityReading" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "usage" DOUBLE PRECISION NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "UtilityReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Registration" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "sticker" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Registration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "price" DECIMAL(12,2),
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LostFound" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "place" TEXT NOT NULL,
    "description" TEXT,
    "userId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LostFound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SosAlert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "unitCode" TEXT,
    "kind" TEXT NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "ackBy" TEXT,
    "ackAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SosAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UtilityReading_unitId_period_kind_key" ON "UtilityReading"("unitId", "period", "kind");

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoveRequest" ADD CONSTRAINT "MoveRequest_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoveRequest" ADD CONSTRAINT "MoveRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UtilityReading" ADD CONSTRAINT "UtilityReading_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketItem" ADD CONSTRAINT "MarketItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LostFound" ADD CONSTRAINT "LostFound_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SosAlert" ADD CONSTRAINT "SosAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
