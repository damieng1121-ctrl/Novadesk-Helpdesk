import { auth } from "@/lib/auth";
import type { Role } from "@prisma/client";

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

/**
 * Server-side session guard for API routes and server actions.
 * Always derive `tenantId` from here — never trust a client-supplied
 * tenant id/slug for scoping a query.
 *
 * Staff roles (anyone but REQUESTER) are required to have 2FA enabled —
 * mirrors the redirect-to-setup policy in auth.config.ts's `authorized()`
 * callback, enforced again here so a direct API call can't skip it. The
 * 2FA setup/enable routes themselves must pass `enforceTwoFactorForStaff:
 * false`, since a staff member enabling 2FA for the first time necessarily
 * calls them before `twoFactorEnabled` flips true.
 */
export async function requireSession(opts: { enforceTwoFactorForStaff?: boolean } = {}) {
  const { enforceTwoFactorForStaff = true } = opts;
  const session = await auth();
  if (!session?.user) throw new AuthError("Not authenticated", 401);
  if (enforceTwoFactorForStaff && session.user.role !== "REQUESTER" && !session.user.twoFactorEnabled) {
    throw new AuthError("Two-factor authentication must be enabled for this role", 403);
  }
  if (session.user.twoFactorEnabled && !session.user.twoFactorVerified) {
    throw new AuthError("Two-factor verification required", 401);
  }
  return session;
}

/** Same as requireSession, but also requires the user belong to a tenant (i.e. not a platform SUPER_ADMIN acting cross-tenant). */
export async function requireTenantSession() {
  const session = await requireSession();
  if (!session.user.tenantId) {
    throw new AuthError("This action requires a school (tenant) account", 403);
  }
  return session as typeof session & { user: { tenantId: string } };
}

export async function requireRole(roles: Role[]) {
  const session = await requireSession();
  if (!roles.includes(session.user.role)) {
    throw new AuthError("Insufficient permissions", 403);
  }
  return session;
}
