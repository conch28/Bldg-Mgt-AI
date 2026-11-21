-- CreateTable
CREATE TABLE "Pulse" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "unitCode" TEXT,
    "kind" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    "topic" TEXT,
    "sentiment" TEXT,
    "workOrder" INTEGER,
    "followedUp" TIMESTAMP(3),
    "followNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pulse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Pulse_createdAt_idx" ON "Pulse"("createdAt");

-- AddForeignKey
ALTER TABLE "Pulse" ADD CONSTRAINT "Pulse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
