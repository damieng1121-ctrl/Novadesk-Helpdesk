import { z } from "zod";
import { requireTenantSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/roles";

type Params = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(300).nullable().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
});

export async function PATCH(req: Request, { params }: Params) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!isAdmin(session.user.role)) throw new AuthError("Only admins can manage categories", 403);
    const { id } = await params;
    const existing = await prisma.category.findUnique({ where: { id } });
    if (!existing || existing.tenantId !== session.user.tenantId) throw new AuthError("Category not found", 404);

    const body = updateSchema.parse(await req.json());
    return prisma.category.update({ where: { id }, data: body });
  });
}

export async function DELETE(_req: Request, { params }: Params) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!isAdmin(session.user.role)) throw new AuthError("Only admins can manage categories", 403);
    const { id } = await params;
    const existing = await prisma.category.findUnique({ where: { id } });
    if (!existing || existing.tenantId !== session.user.tenantId) throw new AuthError("Category not found", 404);

    // Tickets already filed under this category just lose the tag (categoryId -> null)
    // rather than being blocked or cascade-deleted — a category is an organisational
    // label, not something a ticket's existence should depend on.
    await prisma.ticket.updateMany({ where: { categoryId: id }, data: { categoryId: null } });
    await prisma.category.delete({ where: { id } });
    return { ok: true };
  });
}
