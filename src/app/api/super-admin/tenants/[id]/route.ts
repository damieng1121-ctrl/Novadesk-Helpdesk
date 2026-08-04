import { z } from "zod";
import { requireRole, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

const bodySchema = z.object({ isActive: z.boolean() });

export async function PATCH(req: Request, { params }: Params) {
  return withApiErrors(async () => {
    await requireRole(["SUPER_ADMIN"]);
    const { id } = await params;
    const tenant = await prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new AuthError("School not found", 404);
    const { isActive } = bodySchema.parse(await req.json());
    return prisma.tenant.update({ where: { id }, data: { isActive } });
  });
}
