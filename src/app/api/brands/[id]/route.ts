import { z } from "zod";
import { requireTenantSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/roles";

type Params = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  supportEmail: z.string().trim().toLowerCase().email().max(200).nullable().optional(),
  technicianIds: z.array(z.string()).optional(),
});

async function assertBrandInTenant(id: string, tenantId: string) {
  const brand = await prisma.brand.findUnique({ where: { id } });
  if (!brand || brand.tenantId !== tenantId) throw new AuthError("Brand not found", 404);
}

export async function PATCH(req: Request, { params }: Params) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!isAdmin(session.user.role)) throw new AuthError("Only admins can manage brands", 403);
    const { id } = await params;
    await assertBrandInTenant(id, session.user.tenantId);

    const { technicianIds, ...rest } = updateSchema.parse(await req.json());
    return prisma.brand.update({
      where: { id },
      data: {
        ...rest,
        ...(technicianIds ? { technicians: { set: technicianIds.map((tid) => ({ id: tid })) } } : {}),
      },
      include: { technicians: { select: { id: true, name: true, email: true } } },
    });
  });
}

export async function DELETE(_req: Request, { params }: Params) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!isAdmin(session.user.role)) throw new AuthError("Only admins can manage brands", 403);
    const { id } = await params;
    await assertBrandInTenant(id, session.user.tenantId);

    // Tickets already tagged with this Brand just lose the tag (brandId ->
    // null via the FK's ON DELETE SET NULL) rather than being blocked.
    await prisma.brand.delete({ where: { id } });
    return { ok: true };
  });
}
