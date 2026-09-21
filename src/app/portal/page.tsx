import Link from "next/link";
import { Ticket, CheckCircle2, Clock, AlertTriangle, AlertCircle, CalendarClock } from "lucide-react";
import type { TicketStatus } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PortalHome } from "@/components/portal-home";
import { AnnouncementsBanner } from "@/components/announcements-banner";
import { TicketsByStatusChart, VolumeByPriorityChart } from "@/components/dashboard-charts";

function StatCard({
  label,
  value,
  caption,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  caption: string;
  icon: typeof Ticket;
  color: "blue" | "green" | "indigo" | "red";
}) {
  const badgeStyles = {
    blue: "bg-blue-500",
    green: "bg-green-500",
    indigo: "bg-indigo-500",
    red: "bg-red-500",
  }[color];
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-600">{label}</p>
          <p className="mt-1 text-3xl font-semibold text-slate-900">{value}</p>
        </div>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${badgeStyles} text-white`}>
          <Icon size={18} />
        </span>
      </div>
      <p className="mt-3 text-xs text-slate-600">{caption}</p>
    </div>
  );
}

export default async function DashboardPage() {
  const session = await auth();
  const tenantId = session!.user.tenantId;

  if (session!.user.role === "REQUESTER" && tenantId) {
    return <PortalHome tenantId={tenantId} />;
  }

  if (!tenantId) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">No helpdesk account</h1>
        <p className="mt-2 text-slate-600">
          Your account isn&apos;t attached to the helpdesk yet. Ask an admin to invite you from
          Users &amp; Companies.
        </p>
      </div>
    );
  }

  const now = new Date();
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  const openStatuses: TicketStatus[] = ["OPEN", "IN_PROGRESS", "ON_HOLD"];

  const [
    unassigned,
    myTickets,
    complianceStats,
    recentArticles,
    byStatus,
    byPriority,
    criticalOpen,
    overdueTickets,
    dueTodayTickets,
    resolvedTickets,
  ] = await Promise.all([
    prisma.ticket.count({ where: { tenantId, isDeleted: false, status: { in: ["OPEN", "IN_PROGRESS"] }, assigneeId: null } }),
    prisma.ticket.count({ where: { tenantId, isDeleted: false, assigneeId: session!.user.id, status: { in: openStatuses } } }),
    prisma.complianceAssessment.groupBy({ by: ["status"], where: { tenantId }, _count: true }),
    prisma.kbArticle.findMany({ where: { tenantId, status: "PUBLISHED" }, orderBy: { updatedAt: "desc" }, take: 5 }),
    prisma.ticket.groupBy({ by: ["status"], where: { tenantId, isDeleted: false }, _count: true }),
    prisma.ticket.groupBy({ by: ["priority"], where: { tenantId, isDeleted: false }, _count: true }),
    prisma.ticket.count({ where: { tenantId, isDeleted: false, priority: "CRITICAL", status: { in: openStatuses } } }),
    prisma.ticket.findMany({
      where: { tenantId, isDeleted: false, status: { in: openStatuses }, dueAt: { lt: now } },
      select: { id: true, number: true, subject: true },
      orderBy: { dueAt: "asc" },
      take: 4,
    }),
    prisma.ticket.findMany({
      where: { tenantId, isDeleted: false, status: { in: openStatuses }, dueAt: { gte: now, lte: endOfToday } },
      select: { id: true, number: true, subject: true },
      orderBy: { dueAt: "asc" },
      take: 4,
    }),
    prisma.ticket.findMany({
      where: { tenantId, isDeleted: false, status: "RESOLVED", resolvedAt: { not: null } },
      select: { createdAt: true, resolvedAt: true },
      take: 500,
    }),
  ]);

  const compliantCount = complianceStats.find((s) => s.status === "COMPLIANT")?._count ?? 0;
  const totalItems = await prisma.complianceItem.count();
  const compliancePct = totalItems ? Math.round((compliantCount / totalItems) * 100) : 0;

  const totalTickets = byStatus.reduce((sum, s) => sum + s._count, 0);
  const resolvedOrClosed = byStatus
    .filter((s) => s.status === "RESOLVED" || s.status === "CLOSED")
    .reduce((sum, s) => sum + s._count, 0);
  const resolutionPct = totalTickets ? Math.round((resolvedOrClosed / totalTickets) * 100) : 0;

  const resolutionHours = resolvedTickets.map((t) => Math.max(0, (t.resolvedAt!.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60)));
  const avgResolutionHours = resolutionHours.length ? resolutionHours.reduce((sum, h) => sum + h, 0) / resolutionHours.length : null;
  const avgResolutionLabel =
    avgResolutionHours === null ? "—" : avgResolutionHours < 48 ? `${avgResolutionHours.toFixed(1)}h` : `${(avgResolutionHours / 24).toFixed(1)}d`;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <Link
          href="/portal/tickets/new"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Raise a ticket
        </Link>
      </div>

      <div className="mt-4">
        <AnnouncementsBanner tenantId={tenantId} audience="STAFF" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total tickets" value={totalTickets} caption={`${unassigned} unassigned`} icon={Ticket} color="blue" />
        <StatCard
          label="Resolution rate"
          value={`${resolutionPct}%`}
          caption={`${resolvedOrClosed} of ${totalTickets} resolved`}
          icon={CheckCircle2}
          color="green"
        />
        <StatCard
          label="Avg resolution time"
          value={avgResolutionLabel}
          caption={resolutionHours.length ? `From ${resolutionHours.length} resolved ticket${resolutionHours.length === 1 ? "" : "s"}` : "No resolved tickets yet"}
          icon={Clock}
          color="indigo"
        />
        <StatCard
          label="Critical issues"
          value={criticalOpen}
          caption={criticalOpen ? "Needs attention" : "All clear"}
          icon={AlertTriangle}
          color="red"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-red-100 bg-red-50 p-5">
          <div className="flex items-center gap-2 text-red-800">
            <AlertCircle size={18} />
            <h2 className="font-semibold">Overdue tickets</h2>
          </div>
          <p className="mt-1 text-xs text-red-700">{overdueTickets.length} missed target{overdueTickets.length === 1 ? "" : "s"}</p>
          {overdueTickets.length === 0 ? (
            <p className="mt-4 text-sm italic text-red-700">Excellent! All targets met.</p>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {overdueTickets.map((t) => (
                <li key={t.id}>
                  <Link href={`/portal/tickets/${t.id}`} className="text-sm text-red-800 hover:underline">
                    #{t.number} {t.subject}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-5">
          <div className="flex items-center gap-2 text-amber-800">
            <CalendarClock size={18} />
            <h2 className="font-semibold">Due today</h2>
          </div>
          <p className="mt-1 text-xs text-amber-700">{dueTodayTickets.length} resolution deadline{dueTodayTickets.length === 1 ? "" : "s"}</p>
          {dueTodayTickets.length === 0 ? (
            <p className="mt-4 text-sm italic text-amber-700">No more deadlines for today.</p>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {dueTodayTickets.map((t) => (
                <li key={t.id}>
                  <Link href={`/portal/tickets/${t.id}`} className="text-sm text-amber-800 hover:underline">
                    #{t.number} {t.subject}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">Tickets by status</h2>
          <TicketsByStatusChart byStatus={byStatus.map((s) => ({ status: s.status, count: s._count }))} />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">Volume by priority</h2>
          <VolumeByPriorityChart byPriority={byPriority.map((p) => ({ priority: p.priority, count: p._count }))} />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: "Unassigned", value: unassigned, href: "/portal/tickets?assignee=unassigned" },
          { label: "Assigned to me", value: myTickets, href: "/portal/tickets?assignee=me" },
          { label: "DfE standards met", value: `${compliancePct}%`, href: "/portal/compliance" },
        ].map((s) => (
          <Link key={s.label} href={s.href} className="rounded-xl border border-slate-200 bg-white p-4 hover:border-indigo-300">
            <p className="text-sm text-slate-600">{s.label}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{s.value}</p>
          </Link>
        ))}
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Recently updated knowledge base articles</h2>
          <Link href="/portal/kb" className="text-sm text-indigo-600 hover:underline">
            View all
          </Link>
        </div>
        <div className="mt-3 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {recentArticles.length === 0 && <p className="p-5 text-sm text-slate-700">No published articles yet.</p>}
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
