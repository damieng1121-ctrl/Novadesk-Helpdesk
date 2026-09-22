import type { PrismaClient } from "@prisma/client";

/** One row of ticket data, shaped for both the summary aggregations and the CSV export — a single query backs both. */
export async function buildReportRows(
  prisma: PrismaClient,
  tenantId: string,
  days: number | null,
  companyId?: string | null,
) {
  const createdAt = days ? { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) } : undefined;
  return prisma.ticket.findMany({
    where: {
      tenantId,
      isDeleted: false,
      ...(createdAt ? { createdAt } : {}),
      ...(companyId ? { companyId } : {}),
    },
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
      company: { select: { name: true } },
      requester: { select: { name: true, email: true } },
      assignee: { select: { id: true, name: true, email: true } },
      satisfaction: { select: { rating: true } },
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
  const byCompany = rankedCounts(rows.map((r) => r.company?.name ?? null));
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

  const rated = rows.filter((r) => r.satisfaction);
  const avgSatisfaction = rated.length
    ? rated.reduce((sum, r) => sum + r.satisfaction!.rating, 0) / rated.length
    : null;
  const satisfactionDistribution = [1, 2, 3, 4, 5].map((rating) => ({
    rating,
    count: rated.filter((r) => r.satisfaction!.rating === rating).length,
  }));

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
    avgSatisfaction,
    satisfactionDistribution,
    satisfactionResponses: rated.length,
  };
}

/**
 * Buckets the same rows by day/week/month (whichever keeps the chart
 * readable for the selected range) into created-vs-resolved counts, for the
 * Ticket Volume trend chart. Reuses buildReportRows' output rather than a
 * second query — note this means "resolved" undercounts near the start of
 * the window for the same reason avgResolutionHours does: a ticket created
 * just before the cutoff but resolved inside it isn't in `rows` at all,
 * since the query filters by createdAt, not resolvedAt.
 */
export function buildVolumeTrend(
  rows: ReportRow[],
  days: number,
): { bucketBy: "day" | "week" | "month"; data: { label: string; created: number; resolved: number }[] } {
  const bucketBy: "day" | "week" | "month" = days === 0 || days > 180 ? "month" : days > 45 ? "week" : "day";

  function bucketKey(d: Date): string {
    if (bucketBy === "day") return d.toISOString().slice(0, 10);
    if (bucketBy === "month") return d.toISOString().slice(0, 7);
    const monday = new Date(d);
    const dayIndex = (monday.getUTCDay() + 6) % 7; // 0 = Monday
    monday.setUTCDate(monday.getUTCDate() - dayIndex);
    return monday.toISOString().slice(0, 10);
  }

  const buckets = new Map<string, { created: number; resolved: number }>();
  for (const r of rows) {
    const createdKey = bucketKey(r.createdAt);
    const createdEntry = buckets.get(createdKey) ?? { created: 0, resolved: 0 };
    createdEntry.created += 1;
    buckets.set(createdKey, createdEntry);

    if (r.resolvedAt) {
      const resolvedKey = bucketKey(r.resolvedAt);
      const resolvedEntry = buckets.get(resolvedKey) ?? { created: 0, resolved: 0 };
      resolvedEntry.resolved += 1;
      buckets.set(resolvedKey, resolvedEntry);
    }
  }

  const data = [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, counts]) => ({ label, ...counts }));
  return { bucketBy, data };
}
