import { generateSecret, generateURI, verify } from "otplib";
import QRCode from "qrcode";
import { randomBytes } from "crypto";

export function generateTotpSecret(): string {
  return generateSecret();
}

export async function generateTotpQrCode(email: string, secret: string): Promise<string> {
  const otpauth = generateURI({ issuer: "Novadesk Helpdesk", label: email, secret });
  return QRCode.toDataURL(otpauth);
}

export async function verifyTotpToken(token: string, secret: string): Promise<boolean> {
  try {
    // epochTolerance of 30s allows ~1 step of clock drift either side.
    const result = await verify({ secret, token, epochTolerance: 30 });
    return result.valid;
  } catch {
    return false;
  }
}

export function generateRecoveryCodes(count = 8): string[] {
  return Array.from({ length: count }, () => randomBytes(5).toString("hex"));
}
