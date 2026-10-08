-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "enteredAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Student_enteredAt_idx" ON "Student"("enteredAt");
