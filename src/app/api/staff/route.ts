import { requireTenantSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { canManageTickets, STAFF_ROLES } from "@/lib/roles";

/** Bare id/name/email list of technicians+admins, for assignee pickers — any staff member can read this, not just admins. */
export async function GET() {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!canManageTickets(session.user.role)) throw new AuthError("Only helpdesk staff can view this", 403);
    return prisma.user.findMany({
      where: { tenantId: session.user.tenantId, role: { in: STAFF_ROLES }, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    });
  });
}
