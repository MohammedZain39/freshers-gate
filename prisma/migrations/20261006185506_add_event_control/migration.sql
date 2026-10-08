-- CreateTable
CREATE TABLE "EventControl" (
    "id" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "entryEnabled" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3),
    "stoppedAt" TIMESTAMP(3),
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventControl_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventControl_eventName_key" ON "EventControl"("eventName");

-- AddForeignKey
ALTER TABLE "EventControl" ADD CONSTRAINT "EventControl_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
