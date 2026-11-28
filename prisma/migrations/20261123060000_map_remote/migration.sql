-- Phone remote for the 3D city map demo.
CREATE TABLE "MapRemote" (
    "code" TEXT NOT NULL,
    "seq" INTEGER NOT NULL DEFAULT 0,
    "cmd" TEXT NOT NULL DEFAULT '',
    "state" TEXT NOT NULL DEFAULT '',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MapRemote_pkey" PRIMARY KEY ("code")
);
