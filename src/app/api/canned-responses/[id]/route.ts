import { requireTenantSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/roles";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!isAdmin(session.user.role)) throw new AuthError("Only admins can manage canned responses", 403);
    const { id } = await params;

    const response = await prisma.cannedResponse.findUnique({ where: { id } });
    if (!response || response.tenantId !== session.user.tenantId) throw new AuthError("Not found", 404);

    await prisma.cannedResponse.delete({ where: { id } });
    return { ok: true };
  });
}
