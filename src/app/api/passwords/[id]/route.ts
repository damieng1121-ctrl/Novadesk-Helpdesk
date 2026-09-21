import { z } from "zod";
import { requireTenantSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/roles";
import { encrypt } from "@/lib/crypto";

type Params = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  title: z.string().trim().min(1).max(150).optional(),
  username: z.string().trim().max(150).nullable().optional(),
  password: z.string().min(1).max(500).optional(),
  url: z.string().trim().max(500).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export async function PATCH(req: Request, { params }: Params) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!isAdmin(session.user.role)) throw new AuthError("Only admins can edit password entries", 403);
    const { id } = await params;
    const existing = await prisma.passwordEntry.findUnique({ where: { id } });
    if (!existing || existing.tenantId !== session.user.tenantId) throw new AuthError("Not found", 404);

    const { password, ...rest } = updateSchema.parse(await req.json());
    return prisma.passwordEntry.update({
      where: { id },
      data: { ...rest, ...(password ? { encryptedPassword: encrypt(password) } : {}) },
      select: { id: true, title: true, username: true, url: true, notes: true, updatedAt: true },
    });
  });
}

export async function DELETE(_req: Request, { params }: Params) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!isAdmin(session.user.role)) throw new AuthError("Only admins can delete password entries", 403);
    const { id } = await params;
    const existing = await prisma.passwordEntry.findUnique({ where: { id } });
    if (!existing || existing.tenantId !== session.user.tenantId) throw new AuthError("Not found", 404);

    await prisma.passwordEntry.delete({ where: { id } });
    await prisma.auditLog.create({
      data: {
        tenantId: session.user.tenantId,
        userId: session.user.id,
        action: "password.deleted",
        entityType: "PasswordEntry",
        entityId: id,
        metadata: { title: existing.title },
      },
    });
    return { ok: true };
  });
}
