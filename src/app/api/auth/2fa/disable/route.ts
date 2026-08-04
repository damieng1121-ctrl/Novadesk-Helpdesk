import { requireSession } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function POST() {
  return withApiErrors(async () => {
    const session = await requireSession();
    await prisma.user.update({
      where: { id: session.user.id },
      data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorRecoveryCodes: [] },
    });
    await prisma.auditLog.create({
      data: {
        tenantId: session.user.tenantId,
        userId: session.user.id,
        action: "2fa.disabled",
        entityType: "User",
        entityId: session.user.id,
      },
    });
    return { ok: true };
  });
}
