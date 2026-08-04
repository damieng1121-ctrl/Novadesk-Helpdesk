/**
 * Multi-tenancy helpers.
 *
 * Tenant isolation in Novadesk is enforced two ways:
 *  1. Every tenant-scoped Prisma model has a `tenantId` column.
 *  2. Every API route and server action resolves `tenantId` from the
 *     authenticated session (via `requireSession`/`requireTenant` below) —
 *     NEVER from a client-supplied value (query param, body field, header).
 *     This is what actually prevents one school from reading another
 *     school's tickets, even if a request is crafted by hand.
 *
 * In production, each tenant is also reachable at its own subdomain
 * (`{slug}.NEXT_PUBLIC_ROOT_DOMAIN`), resolved in middleware.ts purely for
 * branding/UX (e.g. picking which school's login page to show) — it is not
 * itself a security boundary.
 */

export function getRootDomain(): string {
  return process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
}

/** Extract the tenant subdomain from a request host header, if present. */
export function getTenantSlugFromHost(host: string | null): string | null {
  if (!host) return null;
  const root = getRootDomain();
  const hostname = host.split(":")[0];
  const rootHostname = root.split(":")[0];

  if (hostname === rootHostname || hostname === "localhost" || hostname === "127.0.0.1") {
    return null;
  }
  if (hostname.endsWith(`.${rootHostname}`)) {
    const sub = hostname.slice(0, -(rootHostname.length + 1));
    if (sub && sub !== "www" && sub !== "app") return sub;
  }
  return null;
}

/** Given an email address, return the domain portion (lowercased), or null. */
export function getEmailDomain(email: string): string | null {
  const parts = email.toLowerCase().split("@");
  return parts.length === 2 ? parts[1] : null;
}
