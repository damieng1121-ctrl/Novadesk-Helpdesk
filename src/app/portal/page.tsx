import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function DashboardPage() {
  const session = await auth();
  const tenantId = session!.user.tenantId;

  if (!tenantId) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Platform admin</h1>
        <p className="mt-2 text-slate-600">
          You&apos;re signed in as a Novadesk platform administrator without a school selected. School
          portal features (tickets, knowledge base, compliance) are scoped per-tenant.
        </p>
      </div>
    );
  }

  const [openTickets, unassigned, myTickets, complianceStats, recentArticles] = await Promise.all([
    prisma.ticket.count({ where: { tenantId, status: { in: ["OPEN", "IN_PROGRESS", "ON_HOLD"] } } }),
    prisma.ticket.count({ where: { tenantId, status: { in: ["OPEN", "IN_PROGRESS"] }, assigneeId: null } }),
    prisma.ticket.count({ where: { tenantId, assigneeId: session!.user.id, status: { in: ["OPEN", "IN_PROGRESS", "ON_HOLD"] } } }),
    prisma.complianceAssessment.groupBy({ by: ["status"], where: { tenantId }, _count: true }),
    prisma.kbArticle.findMany({ where: { tenantId, status: "PUBLISHED" }, orderBy: { updatedAt: "desc" }, take: 5 }),
  ]);

  const compliantCount = complianceStats.find((s) => s.status === "COMPLIANT")?._count ?? 0;
  const totalItems = await prisma.complianceItem.count();
  const compliancePct = totalItems ? Math.round((compliantCount / totalItems) * 100) : 0;

  const stats = [
    { label: "Open tickets", value: openTickets, href: "/portal/tickets" },
    { label: "Unassigned", value: unassigned, href: "/portal/tickets?assignee=unassigned" },
    { label: "Assigned to me", value: myTickets, href: "/portal/tickets?assignee=me" },
    { label: "DfE standards met", value: `${compliancePct}%`, href: "/portal/compliance" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <Link
          href="/portal/tickets/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Raise a ticket
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="rounded-xl border border-slate-200 bg-white p-5 hover:border-blue-300"
          >
            <p className="text-sm text-slate-500">{s.label}</p>
            <p className="mt-1 text-3xl font-semibold text-slate-900">{s.value}</p>
          </Link>
        ))}
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Recently updated knowledge base articles</h2>
          <Link href="/portal/kb" className="text-sm text-blue-600 hover:underline">
            View all
          </Link>
        </div>
        <div className="mt-3 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {recentArticles.length === 0 && <p className="p-5 text-sm text-slate-500">No published articles yet.</p>}
          {recentArticles.map((a) => (
            <Link key={a.id} href={`/portal/kb/${a.slug}`} className="block p-4 hover:bg-slate-50">
              <p className="font-medium text-slate-900">{a.title}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
