-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "companyId" TEXT;

-- CreateIndex
CREATE INDEX "Ticket_tenantId_companyId_idx" ON "Ticket"("tenantId", "companyId");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
