import { z } from "zod";
import { requireTenantSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { canManageTickets, isAdmin } from "@/lib/roles";

type Params = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "ORDERED", "DELIVERED"]).optional(),
  isDeleted: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: Params) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!canManageTickets(session.user.role)) throw new AuthError("Staff only", 403);
    const { id } = await params;

    const record = await prisma.financeRecord.findUnique({ where: { id } });
    if (!record || record.tenantId !== session.user.tenantId) throw new AuthError("Not found", 404);

    const body = bodySchema.parse(await req.json());
    // Approving/changing status is a budget decision — admin only. Any staff
    // member can still soft-delete/restore their own team's mistaken entries.
    if (body.status && !isAdmin(session.user.role)) {
      throw new AuthError("Only admins can change approval status", 403);
    }

    return prisma.financeRecord.update({
      where: { id },
      data: body,
      include: { requestedBy: { select: { name: true, email: true } } },
    });
  });
}
