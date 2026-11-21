-- Photo-to-ticket: resident photo and AI reading on work orders
ALTER TABLE "WorkOrder" ADD COLUMN "photo" TEXT;
ALTER TABLE "WorkOrder" ADD COLUMN "aiNote" TEXT;
