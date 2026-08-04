import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe Auth.js config (no Prisma adapter — the adapter needs a Node.js
 * runtime). This is what middleware.ts uses to gate routes; the full config
 * with the Prisma adapter and provider secrets lives in src/lib/auth.ts.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    // Pure token -> session.user field mapping, no DB access — safe to share
    // between the edge (middleware, via this config) and the full Node
    // config in auth.ts. Without this here, middleware's `auth` object
    // would only have next-auth's default session.user shape (no role,
    // tenantId, or 2FA flags), silently breaking every role/2FA check below.
    session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.tenantId = token.tenantId;
      session.user.twoFactorEnabled = token.twoFactorEnabled;
      session.user.twoFactorVerified = token.twoFactorVerified;
      return session;
    },
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const pathname = request.nextUrl.pathname;

      const isPortalRoute = pathname.startsWith("/portal");
      const isTwoFactorRoute = pathname.startsWith("/verify-2fa");

      if (isPortalRoute) {
        if (!isLoggedIn || !auth?.user) return false;

        // Staff (anyone but a plain requester) must have 2FA enabled at all —
        // it's not optional for accounts that can see other people's tickets,
        // internal notes, or admin settings. Requesters can still opt in from
        // Account > Security, but aren't forced to.
        const requiresTwoFactor = auth.user.role !== "REQUESTER";
        const isSecurityPage = pathname.startsWith("/portal/account/security");
        if (requiresTwoFactor && !auth.user.twoFactorEnabled && !isSecurityPage) {
          return Response.redirect(new URL("/portal/account/security?setup2fa=1", request.nextUrl));
        }

        // Users who have 2FA enabled but haven't verified this session yet
        // must be sent to /verify-2fa before reaching any portal route.
        if (auth.user.twoFactorEnabled && !auth.user.twoFactorVerified) {
          return Response.redirect(new URL("/verify-2fa", request.nextUrl));
        }
        return true;
      }

      if (isTwoFactorRoute && !isLoggedIn) return false;

      return true;
    },
  },
  providers: [], // populated in auth.ts (kept out of the edge bundle)
} satisfies NextAuthConfig;
