import { requireTenantSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/roles";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!isAdmin(session.user.role)) throw new AuthError("Only admins can manage agent tools", 403);
    const { id } = await params;

    const link = await prisma.agentToolLink.findUnique({ where: { id } });
    if (!link || link.tenantId !== session.user.tenantId) throw new AuthError("Not found", 404);

    await prisma.agentToolLink.delete({ where: { id } });
    return { ok: true };
  });
}
