import { z } from "zod";
import { requireTenantSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/roles";

type Params = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  role: z.enum(["REQUESTER", "AGENT", "TENANT_ADMIN"]).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: Params) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!isAdmin(session.user.role)) throw new AuthError("Only admins can manage users", 403);
    const { id } = await params;

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target || target.tenantId !== session.user.tenantId) throw new AuthError("User not found", 404);
    if (target.id === session.user.id) throw new AuthError("You can't change your own role here", 400);

    const body = bodySchema.parse(await req.json());
    const user = await prisma.user.update({ where: { id }, data: body });

    await prisma.auditLog.create({
      data: {
        tenantId: session.user.tenantId,
        userId: session.user.id,
        action: "user.updated",
        entityType: "User",
        entityId: id,
        metadata: body,
      },
    });

    return user;
  });
}
