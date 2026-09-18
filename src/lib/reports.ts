import type { PrismaClient } from "@prisma/client";

/** One row of ticket data, shaped for both the summary aggregations and the CSV export — a single query backs both. */
export async function buildReportRows(prisma: PrismaClient, tenantId: string, days: number | null) {
  const createdAt = days ? { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) } : undefined;
  return prisma.ticket.findMany({
    where: { tenantId, isDeleted: false, ...(createdAt ? { createdAt } : {}) },
    orderBy: { createdAt: "desc" },
    select: {
      number: true,
      subject: true,
      status: true,
      priority: true,
      createdAt: true,
      resolvedAt: true,
      dueAt: true,
      category: { select: { name: true } },
      brand: { select: { name: true } },
      requester: { select: { name: true, email: true, company: { select: { name: true } } } },
      assignee: { select: { id: true, name: true, email: true } },
    },
  });
}

export type ReportRow = Awaited<ReturnType<typeof buildReportRows>>[number];

function rankedCounts(labels: (string | null)[]): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const label of labels) {
    const key = label ?? "Uncategorised";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

export function summarizeReportRows(rows: ReportRow[]) {
  const byStatus = rankedCounts(rows.map((r) => r.status)).map((r) => ({ status: r.label, count: r.count }));
  const byPriority = rankedCounts(rows.map((r) => r.priority)).map((r) => ({ priority: r.label, count: r.count }));
  const byCategory = rankedCounts(rows.map((r) => r.category?.name ?? null));
  const byCompany = rankedCounts(rows.map((r) => r.requester.company?.name ?? null));
  const byBrand = rankedCounts(rows.map((r) => r.brand?.name ?? null));

  const now = Date.now();
  const openOverdue = rows.filter(
    (r) => ["OPEN", "IN_PROGRESS", "ON_HOLD"].includes(r.status) && r.dueAt && r.dueAt.getTime() < now,
  ).length;

  const resolved = rows.filter((r) => r.resolvedAt);
  const resolutionHours = resolved.map((r) => (r.resolvedAt!.getTime() - r.createdAt.getTime()) / (1000 * 60 * 60));
  const avgResolutionHours = resolutionHours.length
    ? resolutionHours.reduce((sum, h) => sum + h, 0) / resolutionHours.length
    : null;

  const agentStats = new Map<
    string,
    { name: string; open: number; resolved: number; resolutionHoursTotal: number; resolutionCount: number }
  >();
  for (const r of rows) {
    if (!r.assignee) continue;
    const entry = agentStats.get(r.assignee.id) ?? {
      name: r.assignee.name ?? r.assignee.email ?? "Unknown",
      open: 0,
      resolved: 0,
      resolutionHoursTotal: 0,
      resolutionCount: 0,
    };
    if (["OPEN", "IN_PROGRESS", "ON_HOLD"].includes(r.status)) entry.open += 1;
    if (r.resolvedAt) {
      entry.resolved += 1;
      entry.resolutionHoursTotal += (r.resolvedAt.getTime() - r.createdAt.getTime()) / (1000 * 60 * 60);
      entry.resolutionCount += 1;
    }
    agentStats.set(r.assignee.id, entry);
  }
  const agentLeaderboard = [...agentStats.values()]
    .map((a) => ({
      name: a.name,
      open: a.open,
      resolved: a.resolved,
      avgResolutionHours: a.resolutionCount ? a.resolutionHoursTotal / a.resolutionCount : null,
    }))
    .sort((a, b) => b.resolved - a.resolved);

  return {
    totalTickets: rows.length,
    byStatus,
    byPriority,
    byCategory,
    byCompany,
    byBrand,
    agentLeaderboard,
    openOverdue,
    avgResolutionHours,
    resolvedSampleSize: resolved.length,
  };
}
