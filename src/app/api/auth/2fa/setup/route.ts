import { requireSession } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { generateTotpSecret, generateTotpQrCode } from "@/lib/twofactor";

/** Begin 2FA enrolment: generate a TOTP secret, store it (not yet enabled), return a QR code. */
export async function POST() {
  return withApiErrors(async () => {
    const session = await requireSession({ enforceTwoFactorForStaff: false });
    const secret = generateTotpSecret();

    await prisma.user.update({
      where: { id: session.user.id },
      data: { twoFactorSecret: encrypt(secret) },
    });

    const qrCodeDataUrl = await generateTotpQrCode(session.user.email ?? session.user.id, secret);
    return { qrCodeDataUrl, secret };
  });
}
