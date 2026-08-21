import { requireMisSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string; guardianId: string }> };

/** Unlinks a guardian from a pupil — the underlying User (parent account) is never deleted. */
export async function DELETE(_req: Request, { params }: Params) {
  return withApiErrors(async () => {
    const session = await requireMisSession();
    const { id: pupilId, guardianId } = await params;

    const link = await prisma.pupilGuardian.findUnique({
      where: { pupilId_guardianId: { pupilId, guardianId } },
    });
    if (!link || link.tenantId !== session.user.tenantId) throw new AuthError("Guardian link not found", 404);

    await prisma.pupilGuardian.delete({ where: { id: link.id } });
    return { ok: true };
  });
}
