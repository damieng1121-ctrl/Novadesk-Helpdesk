import { requireTenantSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { canManageTickets } from "@/lib/roles";
import { buildReportRows, summarizeReportRows } from "@/lib/reports";

export async function GET(req: Request) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!canManageTickets(session.user.role)) {
      throw new AuthError("Only helpdesk staff can view reports", 403);
    }
    const tenantId = session.user.tenantId;
    const days = Number(new URL(req.url).searchParams.get("days") ?? "0") || null;

    const rows = await buildReportRows(prisma, tenantId, days);
    return summarizeReportRows(rows);
  });
}
