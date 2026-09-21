import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";

import { authConfig } from "./auth.config";
import { prisma } from "./db";

const isDevLoginEnabled = process.env.NODE_ENV !== "production";

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      // Auth.js v5 only auto-reads clientId/clientSecret from
      // AUTH_GOOGLE_ID/AUTH_GOOGLE_SECRET (its own naming convention) when
      // they're omitted here — it does NOT fall back to the
      // GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET names used everywhere else in
      // this project (.env.example, docker-compose.yml, README). Without
      // this, clientId silently resolves to undefined and every real
      // Google sign-in fails at Google's end with "OAuth client was not
      // found" — Google literally receives client_id=undefined.
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
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
  ],
  callbacks: {
    ...authConfig.callbacks,
    // Invite-only: sign-in is allowed only for an email an admin has
    // already added (via /portal/admin/users). There is no domain-based
    // auto-provisioning — this is one shared helpdesk, not a per-domain
    // multi-tenant product, so "which company's Workspace this email
    // belongs to" is no longer a signal we trust for access at all.
    async signIn({ user }) {
      if (!user.email) return false;
      const existing = await prisma.user.findUnique({ where: { email: user.email } });
      // A row auto-created from an inbound support email (see the email-to-
      // ticket webhook) has portalAccessGranted: false — it's a ticket
      // requester, not someone an admin has actually invited into the
      // portal, so it must not be enough on its own to sign in.
      return Boolean(existing?.portalAccessGranted);
    },
    async jwt({ token, user, trigger, session }) {
      if (trigger === "update" && session) {
        // Client explicitly told us its 2FA state changed (enable/verify/disable
        // flows) — trust it rather than re-hitting the DB on every session read.
        if (typeof session.twoFactorVerified === "boolean") token.twoFactorVerified = session.twoFactorVerified;
        if (typeof session.twoFactorEnabled === "boolean") token.twoFactorEnabled = session.twoFactorEnabled;
        return token;
      }

      // Only present on a fresh sign-in. Deliberately just reads whatever
      // tenantId/role the user row already has — an admin's invite is the
      // source of truth and must not be silently overwritten on login.
      if (user?.id) {
        const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
          token.tenantId = dbUser.tenantId;
          token.companyId = dbUser.companyId;
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
    // In the intended flow this never fires: `signIn` above rejects any
    // email without a pre-existing row, and PrismaAdapter only calls
    // createUser for a genuinely brand-new one. Kept as a defensive
    // fallback (e.g. a future auth change relaxing that gate) so a stray
    // new row still lands in the one tenant instead of dangling with a
    // null tenantId.
    async createUser({ user }) {
      if (!user.id) return;
      const tenant = await prisma.tenant.findFirst();
      if (tenant) {
        await prisma.user.update({ where: { id: user.id }, data: { tenantId: tenant.id } });
      }
      await prisma.auditLog.create({
        data: {
          tenantId: tenant?.id ?? null,
          action: "user.created",
          entityType: "User",
          entityId: user.id,
          metadata: { email: user.email },
        },
      });
    },
  },
});
