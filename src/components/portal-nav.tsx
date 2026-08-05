"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import type { Role } from "@prisma/client";
import clsx from "clsx";

// Tickets/KB/compliance/admin are all tenant-scoped, so they only make sense
// for staff who actually belong to a school — a platform SUPER_ADMIN (who
// has no tenantId) sees "Schools" instead.
const links = [
  { href: "/portal", label: "Dashboard", roles: null },
  { href: "/portal/tickets", label: "Tickets", roles: ["REQUESTER", "AGENT", "TENANT_ADMIN"] },
  { href: "/portal/kb", label: "Knowledge base", roles: ["REQUESTER", "AGENT", "TENANT_ADMIN"] },
  { href: "/portal/forums", label: "Forums", roles: ["REQUESTER", "AGENT", "TENANT_ADMIN"] },
  { href: "/portal/reports", label: "Reports", roles: ["TENANT_ADMIN", "AGENT"] },
  { href: "/portal/compliance", label: "DfE compliance", roles: ["TENANT_ADMIN", "AGENT"] },
  { href: "/portal/finance", label: "Finance", roles: ["TENANT_ADMIN", "AGENT"] },
  { href: "/portal/assets", label: "Assets", roles: ["TENANT_ADMIN", "AGENT"] },
  { href: "/portal/agent-tools", label: "Agent tools", roles: ["TENANT_ADMIN", "AGENT"] },
  { href: "/portal/admin/announcements", label: "Announcements", roles: ["TENANT_ADMIN"] },
  { href: "/portal/admin/canned-responses", label: "Canned responses", roles: ["TENANT_ADMIN"] },
  { href: "/portal/admin/trash", label: "Trash", roles: ["TENANT_ADMIN"] },
  { href: "/portal/admin/users", label: "Users", roles: ["TENANT_ADMIN"] },
  { href: "/portal/admin/settings", label: "Settings", roles: ["TENANT_ADMIN"] },
  { href: "/portal/super-admin", label: "Schools", roles: ["SUPER_ADMIN"] },
] as const;

/** Modules a school can hide entirely if they don't use them — see /portal/admin/settings. Core nav (dashboard/tickets/KB/settings/users/trash) always shows. */
export const TOGGLEABLE_NAV_ITEMS = [
  { href: "/portal/forums", label: "Forums" },
  { href: "/portal/reports", label: "Reports" },
  { href: "/portal/finance", label: "Finance" },
  { href: "/portal/assets", label: "Assets" },
  { href: "/portal/agent-tools", label: "Agent tools" },
  { href: "/portal/admin/announcements", label: "Announcements" },
  { href: "/portal/admin/canned-responses", label: "Canned responses" },
] as const;

export function PortalNav({
  role,
  userName,
  tenantName,
  appName = "Novadesk",
  hasLogo = false,
  sidebarColor,
  disabledNavItems = [],
}: {
  role: Role;
  userName: string;
  tenantName: string;
  appName?: string;
  hasLogo?: boolean;
  sidebarColor?: string | null;
  disabledNavItems?: string[];
}) {
  const pathname = usePathname();
  const disabled = new Set(disabledNavItems);
  const tinted = Boolean(sidebarColor);

  return (
    <aside
      className={clsx("flex w-64 shrink-0 flex-col border-r", tinted ? "border-black/10" : "border-slate-200 bg-white")}
      style={tinted ? { backgroundColor: sidebarColor! } : undefined}
    >
      <div className={clsx("border-b px-5 py-4", tinted ? "border-black/10" : "border-slate-200")}>
        <div className={clsx("flex items-center gap-2 font-semibold", tinted ? "text-white" : "text-slate-900")}>
          {hasLogo ? (
            // eslint-disable-next-line @next/next/no-img-element -- small admin-uploaded logo, not worth next/image's remote-loader setup
            <img src="/api/tenant/logo" alt="" className="h-7 w-7 shrink-0 rounded-md object-contain" />
          ) : (
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600 text-sm text-white">
              {appName.charAt(0).toUpperCase()}
            </span>
          )}
          {appName}
        </div>
        <p className={clsx("mt-1 truncate text-xs", tinted ? "text-white/70" : "text-slate-700")}>{tenantName}</p>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {links
          .filter((l) => !l.roles || (l.roles as readonly string[]).includes(role))
          .filter((l) => !disabled.has(l.href))
          .map((l) => {
            const active = l.href === "/portal" ? pathname === l.href : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={clsx(
                  "block rounded-md px-3 py-2 text-sm font-medium",
                  active
                    ? tinted
                      ? "bg-white/15 text-white"
                      : "bg-blue-50 text-blue-700"
                    : tinted
                      ? "text-white/80 hover:bg-white/10"
                      : "text-slate-700 hover:bg-slate-100",
                )}
              >
                {l.label}
              </Link>
            );
          })}
      </nav>

      <div className={clsx("border-t p-3", tinted ? "border-black/10" : "border-slate-200")}>
        <Link
          href="/portal/account/security"
          className={clsx(
            "block truncate rounded-md px-3 py-2 text-sm",
            tinted ? "text-white/80 hover:bg-white/10" : "text-slate-700 hover:bg-slate-100",
          )}
        >
          {userName}
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className={clsx(
            "mt-1 w-full rounded-md px-3 py-2 text-left text-sm",
            tinted ? "text-white/60 hover:bg-white/10" : "text-slate-700 hover:bg-slate-100",
          )}
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
