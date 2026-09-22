/**
 * One-off/idempotent: fills in Ticket.companyId for tickets created before
 * that field existed, using each ticket's requester's own Company. Safe to
 * re-run — only ever touches tickets where companyId is still null.
 *
 * Usage: npx tsx scripts/backfill-ticket-company.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const tickets = await prisma.ticket.findMany({
    where: { companyId: null, requester: { companyId: { not: null } } },
    select: { id: true, requester: { select: { companyId: true } } },
  });

  let updated = 0;
  for (const ticket of tickets) {
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { companyId: ticket.requester.companyId },
    });
    updated++;
  }

  console.log(`Backfilled companyId on ${updated} ticket${updated === 1 ? "" : "s"}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
