-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "mergedIntoId" TEXT;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;
