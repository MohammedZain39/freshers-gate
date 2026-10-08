-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('ADMIN', 'SCANNER');

-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "EntryResult" AS ENUM ('ALLOWED', 'DENIED', 'ALREADY_ENTERED');

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'ADMIN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "rollNo" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "program" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE',
    "qrTokenHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntryLog" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "scannerId" TEXT,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "result" "EntryResult" NOT NULL,
    "denialReason" TEXT,

    CONSTRAINT "EntryLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Student_rollNo_key" ON "Student"("rollNo");

-- CreateIndex
CREATE UNIQUE INDEX "Student_qrTokenHash_key" ON "Student"("qrTokenHash");

-- CreateIndex
CREATE INDEX "Student_year_idx" ON "Student"("year");

-- CreateIndex
CREATE INDEX "Student_branch_idx" ON "Student"("branch");

-- CreateIndex
CREATE INDEX "Student_status_idx" ON "Student"("status");

-- CreateIndex
CREATE INDEX "EntryLog_studentId_idx" ON "EntryLog"("studentId");

-- CreateIndex
CREATE INDEX "EntryLog_scannedAt_idx" ON "EntryLog"("scannedAt");

-- AddForeignKey
ALTER TABLE "EntryLog" ADD CONSTRAINT "EntryLog_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryLog" ADD CONSTRAINT "EntryLog_scannerId_fkey" FOREIGN KEY ("scannerId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
