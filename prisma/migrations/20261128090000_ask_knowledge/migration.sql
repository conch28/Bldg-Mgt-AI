-- CreateTable
CREATE TABLE "LegalSource" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "citation" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "agency" TEXT NOT NULL,
    "date" TEXT,
    "topics" TEXT[],
    "summary" TEXT NOT NULL,
    "plain" TEXT NOT NULL,
    "who" TEXT NOT NULL DEFAULT 'all',
    "url" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "reviewedAt" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HouseRule" (
    "id" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "chapter" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "topics" TEXT[],
    "basis" TEXT,
    "status" TEXT NOT NULL DEFAULT 'TEMPLATE',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "editedBy" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HouseRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LegalSource_kind_idx" ON "LegalSource"("kind");
