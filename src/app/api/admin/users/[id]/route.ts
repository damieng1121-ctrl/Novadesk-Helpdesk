import { z } from "zod";
import { requireTenantSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/roles";

type Params = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  role: z.enum(["REQUESTER", "AGENT", "TENANT_ADMIN"]).optional(),
  isActive: z.boolean().optional(),
  companyId: z.string().nullable().optional(),
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
    if (body.companyId) {
      const company = await prisma.company.findUnique({ where: { id: body.companyId } });
      if (!company || company.tenantId !== session.user.tenantId) throw new AuthError("Company not found", 404);
    }
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

/**
 * Hard delete — only succeeds for a user with no linked activity (no
 * tickets raised/assigned, no comments, no authored KB articles etc.),
 * since those relations require a User to exist. Anyone with real history
 * should be disabled instead (the isActive toggle above), not deleted.
 */
export async function DELETE(_req: Request, { params }: Params) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!isAdmin(session.user.role)) throw new AuthError("Only admins can manage users", 403);
    const { id } = await params;

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target || target.tenantId !== session.user.tenantId) throw new AuthError("User not found", 404);
    if (target.id === session.user.id) throw new AuthError("You can't delete your own account", 400);
    if (target.role === "SUPER_ADMIN") throw new AuthError("This account can't be deleted", 400);

    try {
      await prisma.user.delete({ where: { id } });
    } catch (err) {
      const isForeignKeyViolation = typeof err === "object" && err !== null && "code" in err && err.code === "P2003";
      if (isForeignKeyViolation) {
        throw new AuthError(
          "Can't delete this user — they have tickets, replies, or articles on file. Disable them instead.",
          409,
        );
      }
      throw err;
    }

    await prisma.auditLog.create({
      data: {
        tenantId: session.user.tenantId,
        userId: session.user.id,
        action: "user.deleted",
        entityType: "User",
        entityId: id,
        metadata: { email: target.email },
      },
    });

    return { ok: true };
  });
}
