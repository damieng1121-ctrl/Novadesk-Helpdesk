import { requireSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function POST() {
  return withApiErrors(async () => {
    const session = await requireSession();
    if (session.user.role !== "REQUESTER") {
      throw new AuthError("Two-factor authentication is mandatory for this role and can't be turned off", 400);
    }
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
