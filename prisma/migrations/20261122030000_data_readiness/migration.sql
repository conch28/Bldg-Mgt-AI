-- Data readiness: asset registry fields, PM interval source, compliance register, contractor credentials, data issues, register sign-offs.
ALTER TABLE "Asset" ADD COLUMN "manufacturer" TEXT,
  ADD COLUMN "model" TEXT,
  ADD COLUMN "serial" TEXT,
  ADD COLUMN "criticality" TEXT NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN "replacementCost" DECIMAL(12,2),
  ADD COLUMN "ownerName" TEXT,
  ADD COLUMN "specSource" TEXT,
  ADD COLUMN "verifiedBy" TEXT,
  ADD COLUMN "verifiedAt" TIMESTAMP(3),
  ADD COLUMN "manualDocId" TEXT;

ALTER TABLE "PMTask" ADD COLUMN "assetTag" TEXT,
  ADD COLUMN "intervalSource" TEXT NOT NULL DEFAULT 'UNVERIFIED';

CREATE TABLE "ComplianceItem" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "authority" TEXT NOT NULL,
    "docNumber" TEXT,
    "issuedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "renewal" TEXT,
    "ownerName" TEXT,
    "mandatory" BOOLEAN NOT NULL DEFAULT true,
    "ruleConfirmedBy" TEXT,
    "ruleConfirmedAt" TIMESTAMP(3),
    "documentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "enteredBy" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ComplianceItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ComplianceItem_buildingId_expiresAt_idx" ON "ComplianceItem"("buildingId", "expiresAt");

CREATE TABLE "VendorCredential" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "number" TEXT,
    "issuer" TEXT,
    "expiresAt" TIMESTAMP(3),
    "documentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "enteredBy" TEXT NOT NULL,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VendorCredential_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "VendorCredential_vendorId_idx" ON "VendorCredential"("vendorId");

CREATE TABLE "DataIssue" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "checkId" TEXT NOT NULL,
    "entityKey" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "ownerRole" TEXT NOT NULL,
    "href" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "evidence" TEXT,
    CONSTRAINT "DataIssue_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DataIssue_buildingId_checkId_entityKey_key" ON "DataIssue"("buildingId", "checkId", "entityKey");
CREATE INDEX "DataIssue_buildingId_status_severity_idx" ON "DataIssue"("buildingId", "status", "severity");

CREATE TABLE "ReadinessSignoff" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "reqId" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "approvedBy" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    CONSTRAINT "ReadinessSignoff_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ReadinessSignoff_buildingId_reqId_key" ON "ReadinessSignoff"("buildingId", "reqId");
