import { requireTenantSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { canManageTickets } from "@/lib/roles";

export async function GET() {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!canManageTickets(session.user.role)) {
      throw new AuthError("Only helpdesk staff can view reports", 403);
    }
    const tenantId = session.user.tenantId;

    const [byStatus, byPriority, openOverdue, resolvedTickets] = await Promise.all([
      prisma.ticket.groupBy({ by: ["status"], where: { tenantId }, _count: true }),
      prisma.ticket.groupBy({ by: ["priority"], where: { tenantId }, _count: true }),
      prisma.ticket.count({
        where: { tenantId, status: { in: ["OPEN", "IN_PROGRESS", "ON_HOLD"] }, dueAt: { lt: new Date() } },
      }),
      prisma.ticket.findMany({
        where: { tenantId, status: "RESOLVED", resolvedAt: { not: null } },
        select: { createdAt: true, resolvedAt: true },
        take: 500,
        orderBy: { resolvedAt: "desc" },
      }),
    ]);

    const resolutionHours = resolvedTickets.map(
      (t) => (t.resolvedAt!.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60),
    );
    const avgResolutionHours = resolutionHours.length
      ? resolutionHours.reduce((sum, h) => sum + h, 0) / resolutionHours.length
      : null;

    return {
      totalTickets: byStatus.reduce((sum, s) => sum + s._count, 0),
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
      byPriority: byPriority.map((p) => ({ priority: p.priority, count: p._count })),
      openOverdue,
      avgResolutionHours,
      resolvedSampleSize: resolutionHours.length,
    };
  });
}
