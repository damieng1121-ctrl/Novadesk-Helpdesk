import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";

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
      // Lets a Google sign-in "claim" a User row an admin pre-created via
      // invite (no linked account yet). Normally risky ("account takeover
      // through a second, less-trusted provider"), but Google is the only
      // real provider here, so there's no second provider to attack through.
      allowDangerousEmailAccountLinking: true,
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
    // Parents have no Google Workspace account, so they sign in with a
    // school-issued email + a password they set via /parent/set-password.
    // Runs in every environment (unlike dev-login above) — this is parents'
    // only way into the product.
    Credentials({
      id: "parent-login",
      name: "Parent login",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === "string" ? credentials.email.toLowerCase() : undefined;
        const password = typeof credentials?.password === "string" ? credentials.password : undefined;
        if (!email || !password) return null;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || user.role !== "PARENT" || !user.passwordHash || !user.isActive) return null;
        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;
        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user }) {
      if (!user.email) return false;
      // A pre-provisioned row (an admin's manual invite/assignment) is
      // always allowed to sign in, regardless of its email's domain —
      // that manual assignment is what makes it a member of a school.
      const existing = await prisma.user.findUnique({ where: { email: user.email } });
      if (existing && (existing.tenantId !== null || existing.role === "SUPER_ADMIN")) return true;
      // Otherwise fall back to domain-based auto-provisioning for a
      // genuinely first-ever sign-in.
      const resolved = await resolveTenantAndRole(user.email);
      return resolved !== null;
    },
    async jwt({ token, user, trigger, session }) {
      if (trigger === "update" && session) {
        // Client explicitly told us its 2FA state changed (enable/verify/disable
        // flows) — trust it rather than re-hitting the DB on every session read.
        if (typeof session.twoFactorVerified === "boolean") token.twoFactorVerified = session.twoFactorVerified;
        if (typeof session.twoFactorEnabled === "boolean") token.twoFactorEnabled = session.twoFactorEnabled;
        // Only a real platform SUPER_ADMIN can ever set this — never an
        // ordinary tenant user overriding their own membership. Validated
        // against a real, active school so a stale/bogus id can't linger.
        if ("actingTenantId" in session && token.role === "SUPER_ADMIN") {
          if (session.actingTenantId === null) {
            token.actingTenantId = null;
          } else if (typeof session.actingTenantId === "string") {
            const tenant = await prisma.tenant.findUnique({ where: { id: session.actingTenantId } });
            token.actingTenantId = tenant?.isActive ? tenant.id : null;
          }
        }
        return token;
      }

      // Only present on a fresh sign-in. Deliberately just reads whatever
      // tenantId/role the user row already has — never recomputes it from
      // the email's domain here. Domain-based auto-provisioning only ever
      // happens once, in the createUser event below, for a brand-new row;
      // after that, an admin's manual invite/reassignment is the source of
      // truth and must not be silently overwritten on the next login.
      if (user?.id) {
        const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
          token.tenantId = dbUser.tenantId;
          token.actingTenantId = null;
          token.twoFactorEnabled = dbUser.twoFactorEnabled;
          token.twoFactorVerified = !dbUser.twoFactorEnabled;
          token.isTeacher = dbUser.isTeacher;
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
