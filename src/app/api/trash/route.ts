import { requireTenantSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/roles";

export async function GET() {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!isAdmin(session.user.role)) throw new AuthError("Only admins can view the trash bin", 403);
    const tenantId = session.user.tenantId;

    const [tickets, articles, assets, financeRecords] = await Promise.all([
      prisma.ticket.findMany({
        where: { tenantId, isDeleted: true },
        orderBy: { updatedAt: "desc" },
        select: { id: true, number: true, subject: true, updatedAt: true },
      }),
      prisma.kbArticle.findMany({
        where: { tenantId, isDeleted: true },
        orderBy: { updatedAt: "desc" },
        select: { id: true, slug: true, title: true, updatedAt: true },
      }),
      prisma.asset.findMany({
        where: { tenantId, isDeleted: true },
        orderBy: { updatedAt: "desc" },
        select: { id: true, tag: true, name: true, updatedAt: true },
      }),
      prisma.financeRecord.findMany({
        where: { tenantId, isDeleted: true },
        orderBy: { updatedAt: "desc" },
        select: { id: true, poNumber: true, description: true, updatedAt: true },
      }),
    ]);

    return { tickets, articles, assets, financeRecords };
  });
}
