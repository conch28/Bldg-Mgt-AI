-- Staff data scores, spot audits and entry flags
ALTER TABLE "WorkOrder" ADD COLUMN "photoSig" TEXT;
ALTER TABLE "WorkOrder" ADD COLUMN "donePhotoSig" TEXT;

CREATE TABLE "SpotAudit" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "person" TEXT NOT NULL,
    "weekOf" TEXT NOT NULL,
    "pickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "checkedAt" TIMESTAMP(3),
    "checkedBy" TEXT,
    "result" TEXT,
    "note" TEXT,
    "photo" TEXT,
    CONSTRAINT "SpotAudit_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SpotAudit_kind_refId_key" ON "SpotAudit"("kind", "refId");
CREATE INDEX "SpotAudit_weekOf_idx" ON "SpotAudit"("weekOf");

CREATE TABLE "EntryFlag" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "person" TEXT NOT NULL,
    "refs" TEXT[],
    "href" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "severity" INTEGER NOT NULL,
    "aiNote" TEXT,
    "explanation" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EntryFlag_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EntryFlag_key_key" ON "EntryFlag"("key");
CREATE INDEX "EntryFlag_status_idx" ON "EntryFlag"("status");
CREATE INDEX "EntryFlag_person_idx" ON "EntryFlag"("person");
