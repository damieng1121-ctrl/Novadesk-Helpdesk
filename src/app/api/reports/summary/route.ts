import { requireTenantSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { canManageTickets } from "@/lib/roles";
import { buildReportRows, summarizeReportRows, buildVolumeTrend } from "@/lib/reports";

export async function GET(req: Request) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!canManageTickets(session.user.role)) {
      throw new AuthError("Only helpdesk staff can view reports", 403);
    }
    const tenantId = session.user.tenantId;
    const { searchParams } = new URL(req.url);
    const days = Number(searchParams.get("days") ?? "0") || null;
    const companyId = searchParams.get("companyId") || null;

    const rows = await buildReportRows(prisma, tenantId, days, companyId);
    return { ...summarizeReportRows(rows), volumeTrend: buildVolumeTrend(rows, days ?? 0) };
  });
}
