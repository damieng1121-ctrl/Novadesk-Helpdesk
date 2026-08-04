import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";

import { authConfig } from "./auth.config";
import { prisma } from "./db";
import { getEmailDomain } from "./tenancy";

function superAdminEmails(): string[] {
  return (process.env.NOVADESK_SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Resolve which tenant a sign-in belongs to, from the email's domain
 * against each Tenant's Google Workspace `domain`. Also handles the
 * platform super-admin allowlist. Idempotent — safe to call on every
 * sign-in, not just the first.
 */
async function resolveTenantAndRole(email: string) {
  if (superAdminEmails().includes(email.toLowerCase())) {
    return { tenantId: null, role: "SUPER_ADMIN" as const };
  }
  const domain = getEmailDomain(email);
  if (!domain) return null;
  const tenant = await prisma.tenant.findUnique({ where: { domain } });
  if (!tenant || !tenant.isActive) return null;
  return { tenantId: tenant.id, role: "REQUESTER" as const };
}

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      authorization: {
        params: {
          // Nudges Google's account chooser toward the user's Workspace
          // account rather than a personal Gmail account.
          hd: "*",
          prompt: "select_account",
        },
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user }) {
      if (!user.email) return false;
      const resolved = await resolveTenantAndRole(user.email);
      // Deny sign-in for any Google account whose domain isn't a
      // registered, active school tenant (or the platform admin allowlist).
      return resolved !== null;
    },
    async jwt({ token, user, trigger, session }) {
      if (trigger === "update" && session?.twoFactorVerified) {
        token.twoFactorVerified = true;
        return token;
      }

      if (user?.email) {
        const resolved = await resolveTenantAndRole(user.email);
        if (resolved) {
          const dbUser = await prisma.user.update({
            where: { id: user.id },
            data: {
              tenantId: resolved.tenantId,
              role: resolved.tenantId === null ? resolved.role : undefined,
            },
          });
          token.id = dbUser.id;
          token.role = dbUser.role;
          token.tenantId = dbUser.tenantId;
          token.twoFactorEnabled = dbUser.twoFactorEnabled;
          token.twoFactorVerified = !dbUser.twoFactorEnabled;
        }
      }

      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.tenantId = token.tenantId;
      session.user.twoFactorEnabled = token.twoFactorEnabled;
      session.user.twoFactorVerified = token.twoFactorVerified;
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      if (!user.email || !user.id) return;
      const resolved = await resolveTenantAndRole(user.email);
      if (resolved) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            tenantId: resolved.tenantId,
            role: resolved.role,
          },
        });
      }
      await prisma.auditLog.create({
        data: {
          tenantId: resolved?.tenantId ?? null,
          action: "user.created",
          entityType: "User",
          entityId: user.id,
          metadata: { email: user.email },
        },
      });
    },
  },
});
