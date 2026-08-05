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
  { href: "/portal/admin/announcements", label: "Announcements", roles: ["TENANT_ADMIN"] },
  { href: "/portal/admin/users", label: "Users", roles: ["TENANT_ADMIN"] },
  { href: "/portal/admin/settings", label: "Settings", roles: ["TENANT_ADMIN"] },
  { href: "/portal/super-admin", label: "Schools", roles: ["SUPER_ADMIN"] },
] as const;

export function PortalNav({
  role,
  userName,
  tenantName,
}: {
  role: Role;
  userName: string;
  tenantName: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex items-center gap-2 font-semibold text-slate-900">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600 text-sm text-white">
            N
          </span>
          Novadesk
        </div>
        <p className="mt-1 truncate text-xs text-slate-500">{tenantName}</p>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {links
          .filter((l) => !l.roles || (l.roles as readonly string[]).includes(role))
          .map((l) => {
            const active = l.href === "/portal" ? pathname === l.href : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={clsx(
                  "block rounded-md px-3 py-2 text-sm font-medium",
                  active ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-100",
                )}
              >
                {l.label}
              </Link>
            );
          })}
      </nav>

      <div className="border-t border-slate-200 p-3">
        <Link href="/portal/account/security" className="block truncate rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
          {userName}
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="mt-1 w-full rounded-md px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-100"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
