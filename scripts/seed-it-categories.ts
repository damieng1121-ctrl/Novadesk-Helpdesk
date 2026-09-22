/**
 * One-off/idempotent: seeds a starter set of IT ticket categories (the
 * Category model, shown to requesters when raising a ticket and used for
 * triage/reporting). Safe to re-run — upserts by [tenantId, name], so it
 * only fills in whatever's missing and never duplicates or overwrites a
 * category someone's already customised.
 *
 * Usage: npx tsx scripts/seed-it-categories.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CATEGORIES: { name: string; description: string; color: string }[] = [
  { name: "Hardware", description: "Desktops, laptops, peripherals, and physical device faults", color: "#3b82f6" },
  { name: "Software", description: "Application installs, licensing, updates, and bugs", color: "#6366f1" },
  { name: "Network & Wi-Fi", description: "Connectivity issues, dead spots, and network faults", color: "#06b6d4" },
  { name: "Account & Access", description: "Password resets, login issues, and permissions", color: "#8b5cf6" },
  { name: "Email", description: "Mailbox issues, distribution lists, and spam/phishing reports", color: "#0ea5e9" },
  { name: "Printing", description: "Printers, copiers, and scanning issues", color: "#f97316" },
  { name: "AV & Classroom Tech", description: "Interactive whiteboards, projectors, and classroom displays", color: "#ec4899" },
  { name: "Telephony", description: "Phone system and handset issues", color: "#14b8a6" },
  { name: "MIS / SIMS", description: "School management information system issues", color: "#a855f7" },
  { name: "Safeguarding & Filtering", description: "Internet filtering, monitoring, and safeguarding-related IT issues", color: "#ef4444" },
  { name: "New Starter / Leaver", description: "Account and equipment setup or teardown for staff changes", color: "#22c55e" },
  { name: "Training & Guidance", description: "How-to requests and training on existing systems", color: "#eab308" },
  { name: "Quote", description: "Requests for a quote on new equipment, software, or services", color: "#f59e0b" },
  { name: "General Enquiry", description: "Anything that doesn't fit another category", color: "#64748b" },
];

async function main() {
  const tenant = await prisma.tenant.findFirstOrThrow();

  let created = 0;
  let alreadyExisted = 0;
  for (const category of CATEGORIES) {
    const existing = await prisma.category.findUnique({
      where: { tenantId_name: { tenantId: tenant.id, name: category.name } },
    });
    if (existing) {
      alreadyExisted++;
      continue;
    }
    await prisma.category.create({ data: { tenantId: tenant.id, ...category } });
    created++;
  }
  console.log(`Tenant "${tenant.name}": created ${created} new categories, ${alreadyExisted} already existed.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
