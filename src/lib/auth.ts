import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";

import { authConfig } from "./auth.config";
import { prisma } from "./db";
import { getEmailDomain } from "./tenancy";

const isDevLoginEnabled = process.env.NODE_ENV !== "production";

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
    // Non-production only (excluded from the array entirely, not just
    // hidden in the UI) — lets you sign in as any already-seeded user by
    // email with no password, for local/demo use before real Google OAuth
    // credentials are set up. Never creates a user: only an existing row
    // can be signed into this way.
    ...(isDevLoginEnabled
      ? [
          Credentials({
            id: "dev-login",
            name: "Dev login (local only)",
            credentials: { email: { label: "Email", type: "email" } },
            async authorize(credentials) {
              if (process.env.NODE_ENV === "production") return null;
              const email = typeof credentials?.email === "string" ? credentials.email : undefined;
              if (!email) return null;
              const user = await prisma.user.findUnique({ where: { email } });
              return user ? { id: user.id, email: user.email, name: user.name, image: user.image } : null;
            },
          }),
        ]
      : []),
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
      if (trigger === "update" && session) {
        // Client explicitly told us its 2FA state changed (enable/verify/disable
        // flows) — trust it rather than re-hitting the DB on every session read.
        if (typeof session.twoFactorVerified === "boolean") token.twoFactorVerified = session.twoFactorVerified;
        if (typeof session.twoFactorEnabled === "boolean") token.twoFactorEnabled = session.twoFactorEnabled;
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
    // session() is inherited from authConfig.callbacks (see auth.config.ts)
    // — it's pure token->session mapping with no DB access, so it's shared
    // as-is rather than duplicated here.
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
