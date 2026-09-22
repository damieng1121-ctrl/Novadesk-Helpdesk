import { z } from "zod";
import { requireTenantSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { canManageTickets, isAdmin } from "@/lib/roles";

type Params = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  tag: z.string().min(1).max(60).optional(),
  name: z.string().min(1).max(150).optional(),
  model: z.string().max(100).nullable().optional(),
  serialNumber: z.string().max(100).nullable().optional(),
  assignedToId: z.string().nullable().optional(),
  companyId: z.string().nullable().optional(),
  status: z.enum(["ACTIVE", "IN_REPAIR", "RETIRED", "LOST"]).optional(),
  purchaseDate: z.string().nullable().optional(),
  warrantyExpiry: z.string().nullable().optional(),
  isDeleted: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: Params) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!canManageTickets(session.user.role)) throw new AuthError("Staff only", 403);
    const { id } = await params;

    const asset = await prisma.asset.findUnique({ where: { id } });
    if (!asset || asset.tenantId !== session.user.tenantId) throw new AuthError("Asset not found", 404);

    const body = bodySchema.parse(await req.json());
    return prisma.asset.update({
      where: { id },
      data: {
        ...body,
        purchaseDate: body.purchaseDate !== undefined ? (body.purchaseDate ? new Date(body.purchaseDate) : null) : undefined,
        warrantyExpiry:
          body.warrantyExpiry !== undefined ? (body.warrantyExpiry ? new Date(body.warrantyExpiry) : null) : undefined,
      },
      include: { assignedTo: { select: { name: true, email: true } }, company: { select: { id: true, name: true } } },
    });
  });
}

/** Permanent, unrecoverable delete — only ever reachable from the trash bin on an already soft-deleted asset. */
export async function DELETE(_req: Request, { params }: Params) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!isAdmin(session.user.role)) throw new AuthError("Only admins can permanently delete assets", 403);
    const { id } = await params;

    const asset = await prisma.asset.findUnique({ where: { id } });
    if (!asset || asset.tenantId !== session.user.tenantId) throw new AuthError("Asset not found", 404);
    if (!asset.isDeleted) throw new AuthError("Move to trash before permanently deleting", 400);

    await prisma.asset.delete({ where: { id } });
    return { ok: true };
  });
}
