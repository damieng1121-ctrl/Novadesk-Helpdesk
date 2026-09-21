import { requireTenantSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(_req: Request, { params }: Params) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    const { id } = await params;
    const existing = await prisma.notification.findUnique({ where: { id } });
    if (!existing || existing.userId !== session.user.id) throw new AuthError("Not found", 404);

    return prisma.notification.update({ where: { id }, data: { isRead: true } });
  });
}
