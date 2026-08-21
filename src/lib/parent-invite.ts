import crypto from "crypto";
import { prisma } from "@/lib/db";
import { getNotificationProvider } from "@/lib/notifications";

const TOKEN_TTL_HOURS = 48;

function setPasswordUrl(token: string): string {
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  return `${base}/parent/set-password?token=${token}`;
}

/**
 * Issues a one-time, time-boxed set-password link for a guardian (User with
 * role=PARENT) and emails it to them. Reuses Auth.js's VerificationToken
 * table rather than a bespoke model — same idea as its built-in email
 * provider, just triggered from our own flow instead of next-auth's.
 * Safe to call again for the same guardian (e.g. "resend invite") — old
 * unused tokens for that email are cleared first so only the latest link works.
 */
export async function issueParentSetPasswordToken(email: string): Promise<void> {
  const identifier = `parent-set-password:${email.toLowerCase()}`;
  await prisma.verificationToken.deleteMany({ where: { identifier } });

  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000);
  await prisma.verificationToken.create({ data: { identifier, token, expires } });

  const notifications = getNotificationProvider();
  const url = setPasswordUrl(token);
  await notifications.send({
    to: email,
    subject: "Set up your parent portal account",
    text: `You've been added as a parent contact. Set your password to access the parent portal:\n\n${url}\n\nThis link expires in ${TOKEN_TTL_HOURS} hours.`,
    html: `<p>You've been added as a parent contact. Set your password to access the parent portal:</p><p><a href="${url}">${url}</a></p><p>This link expires in ${TOKEN_TTL_HOURS} hours.</p>`,
  });
}

/** Consumes a set-password token (single use) and returns the guardian's email, or null if invalid/expired. */
export async function consumeParentSetPasswordToken(token: string): Promise<string | null> {
  const record = await prisma.verificationToken.findUnique({ where: { token } });
  if (!record || !record.identifier.startsWith("parent-set-password:")) return null;
  await prisma.verificationToken.delete({ where: { token } }).catch(() => {});
  if (record.expires < new Date()) return null;
  return record.identifier.slice("parent-set-password:".length);
}
