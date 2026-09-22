-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "FinanceRecord" ADD COLUMN     "companyId" TEXT;

-- CreateIndex
CREATE INDEX "Asset_tenantId_companyId_idx" ON "Asset"("tenantId", "companyId");

-- CreateIndex
CREATE INDEX "FinanceRecord_tenantId_companyId_idx" ON "FinanceRecord"("tenantId", "companyId");

-- AddForeignKey
ALTER TABLE "FinanceRecord" ADD CONSTRAINT "FinanceRecord_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
