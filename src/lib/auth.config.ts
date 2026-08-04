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
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const pathname = request.nextUrl.pathname;

      const isPortalRoute = pathname.startsWith("/portal");
      const isTwoFactorRoute = pathname.startsWith("/verify-2fa");

      if (isPortalRoute) {
        if (!isLoggedIn) return false;
        // Users who have 2FA enabled but haven't verified this session yet
        // must be sent to /verify-2fa before reaching any portal route.
        if (auth?.user.twoFactorEnabled && !auth?.user.twoFactorVerified) {
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
