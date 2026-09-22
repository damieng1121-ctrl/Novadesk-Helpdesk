import { requireTenantSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { canManageTickets } from "@/lib/roles";

/** Lets staff pick who a ticket is "for" when raising one on someone's behalf (e.g. logging a phone call). */
export async function GET(req: Request) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!canManageTickets(session.user.role)) throw new AuthError("Only helpdesk staff can view this", 403);
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get("companyId");
    return prisma.user.findMany({
      where: {
        tenantId: session.user.tenantId,
        isActive: true,
        ...(companyId ? { companyId } : {}),
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, companyId: true },
    });
  });
}
