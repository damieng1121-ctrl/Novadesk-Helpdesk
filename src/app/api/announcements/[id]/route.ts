import { z } from "zod";
import { requireTenantSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/roles";

type Params = { params: Promise<{ id: string }> };

const bodySchema = z.object({ active: z.boolean() });

export async function PATCH(req: Request, { params }: Params) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!isAdmin(session.user.role)) throw new AuthError("Only admins can manage announcements", 403);
    const { id } = await params;

    const announcement = await prisma.announcement.findUnique({ where: { id } });
    if (!announcement || announcement.tenantId !== session.user.tenantId) throw new AuthError("Not found", 404);

    const { active } = bodySchema.parse(await req.json());
    return prisma.announcement.update({ where: { id }, data: { active } });
  });
}
