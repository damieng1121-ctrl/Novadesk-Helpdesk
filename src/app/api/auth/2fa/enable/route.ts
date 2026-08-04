import { z } from "zod";
import bcrypt from "bcryptjs";
import { requireSession } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { verifyTotpToken, generateRecoveryCodes } from "@/lib/twofactor";

const bodySchema = z.object({ token: z.string().length(6) });

/** Confirm 2FA enrolment by verifying one TOTP code, then flip it on and issue recovery codes. */
export async function POST(req: Request) {
  return withApiErrors(async () => {
    const session = await requireSession({ enforceTwoFactorForStaff: false });
    const { token } = bodySchema.parse(await req.json());

    const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
    if (!user.twoFactorSecret) {
      throw new Error("Call /api/auth/2fa/setup first");
    }
    const secret = decrypt(user.twoFactorSecret);
    if (!(await verifyTotpToken(token, secret))) {
      return { ok: false, error: "Invalid code" };
    }

    const recoveryCodes = generateRecoveryCodes();
    const hashedCodes = await Promise.all(recoveryCodes.map((c) => bcrypt.hash(c, 10)));

    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: true, twoFactorRecoveryCodes: hashedCodes },
    });
    await prisma.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        action: "2fa.enabled",
        entityType: "User",
        entityId: user.id,
      },
    });

    // Recovery codes are shown once, in plaintext, and never retrievable again.
    return { ok: true, recoveryCodes };
  });
}
