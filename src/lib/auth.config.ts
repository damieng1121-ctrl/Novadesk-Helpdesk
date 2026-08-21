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
      session.user.actingTenantId = token.actingTenantId ?? null;
      // A real tenant membership always wins; otherwise, for a SUPER_ADMIN
      // "managing" a school, tenantId resolves to that school so every
      // existing tenant-scoped check (requireTenantSession, API routes,
      // page queries) just works without threading actingTenantId through
      // each of them individually.
      session.user.tenantId = token.tenantId ?? (token.role === "SUPER_ADMIN" ? (token.actingTenantId ?? null) : null);
      session.user.twoFactorEnabled = token.twoFactorEnabled;
      session.user.twoFactorVerified = token.twoFactorVerified;
      session.user.isTeacher = token.isTeacher ?? false;
      return session;
    },
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const pathname = request.nextUrl.pathname;

      const isPortalRoute = pathname.startsWith("/portal");
      const isTwoFactorRoute = pathname.startsWith("/verify-2fa");
      const isParentRoute = pathname.startsWith("/parent");
      const isParentSetPasswordRoute = pathname.startsWith("/parent/set-password");
      const isParentLoginRoute = pathname === "/parent/login";

      if (isPortalRoute) {
        if (!isLoggedIn || !auth?.user) return false;
        // Parents have their own portal entirely — a parent account should
        // never end up looking at staff/pupil-admin screens.
        if (auth.user.role === "PARENT") return Response.redirect(new URL("/parent", request.nextUrl));

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

      // /parent/login and /parent/set-password must stay reachable while
      // signed out (that's the whole point); every other /parent route
      // requires a signed-in PARENT account — no 2FA gate, parents don't
      // have one.
      if (isParentRoute && !isParentLoginRoute && !isParentSetPasswordRoute) {
        if (!isLoggedIn || !auth?.user) return Response.redirect(new URL("/parent/login", request.nextUrl));
        if (auth.user.role !== "PARENT") return Response.redirect(new URL("/portal", request.nextUrl));
      }

      return true;
    },
  },
  providers: [], // populated in auth.ts (kept out of the edge bundle)
} satisfies NextAuthConfig;
