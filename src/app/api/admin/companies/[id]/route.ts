import { z } from "zod";
import { requireTenantSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/roles";

type Params = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  name: z.string().trim().min(2).max(150).optional(),
  domain: z.string().trim().max(150).optional().or(z.literal("")),
  urn: z.string().trim().max(20).optional().or(z.literal("")),
  phase: z.enum(["NURSERY", "PRIMARY", "SECONDARY", "ALL_THROUGH", "SPECIAL", "MULTI_ACADEMY_TRUST"]).optional(),
});

export async function PATCH(req: Request, { params }: Params) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!isAdmin(session.user.role)) throw new AuthError("Only admins can manage companies", 403);
    const { id } = await params;

    const company = await prisma.company.findUnique({ where: { id } });
    if (!company || company.tenantId !== session.user.tenantId) throw new AuthError("Company not found", 404);

    const body = updateSchema.parse(await req.json());
    return prisma.company.update({
      where: { id },
      data: {
        ...body,
        domain: body.domain === "" ? null : body.domain,
        urn: body.urn === "" ? null : body.urn,
      },
    });
  });
}

export async function DELETE(_req: Request, { params }: Params) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!isAdmin(session.user.role)) throw new AuthError("Only admins can manage companies", 403);
    const { id } = await params;

    const company = await prisma.company.findUnique({ where: { id } });
    if (!company || company.tenantId !== session.user.tenantId) throw new AuthError("Company not found", 404);

    // Users keep their account, just lose the Company tag (see the model's onDelete: SetNull).
    await prisma.company.delete({ where: { id } });
    return { ok: true };
  });
}
