import { z } from "zod";
import { requireRole, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  role: z.enum(["REQUESTER", "AGENT", "TENANT_ADMIN", "SUPER_ADMIN"]).optional(),
  tenantId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: Params) {
  return withApiErrors(async () => {
    const session = await requireRole(["SUPER_ADMIN"]);
    const { id } = await params;
    if (id === session.user.id) throw new AuthError("You can't change your own access here", 400);

    const body = bodySchema.parse(await req.json());
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) throw new AuthError("User not found", 404);

    const role = body.role ?? target.role;
    const tenantId = body.tenantId !== undefined ? body.tenantId : target.tenantId;
    if (role === "SUPER_ADMIN" !== (tenantId === null)) {
      throw new AuthError("Super admins have no school; every other role needs one", 400);
    }

    const user = await prisma.user.update({ where: { id }, data: { ...body, role, tenantId } });

    await prisma.auditLog.create({
      data: {
        tenantId: tenantId,
        userId: session.user.id,
        action: "user.reassigned",
        entityType: "User",
        entityId: id,
        metadata: body,
      },
    });

    return user;
  });
}
