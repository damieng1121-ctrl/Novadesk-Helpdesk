"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import type { Role } from "@prisma/client";
import clsx from "clsx";
import {
  LayoutDashboard,
  Ticket,
  BookOpen,
  MessageSquare,
  BarChart3,
  ShieldCheck,
  CreditCard,
  Laptop,
  Wrench,
  Megaphone,
  MessageCircle,
  Trash2,
  Users,
  Building2,
  Tag,
  Settings,
  User as UserIcon,
  LogOut,
  type LucideIcon,
} from "lucide-react";

// One shared helpdesk — every signed-in role sees the same nav, scoped by
// what they're allowed to do (a plain User only sees Tickets/KB/Forums; an
// Admin/Technician sees the rest).
const links = [
  { href: "/portal", label: "Dashboard", icon: LayoutDashboard, roles: null },
  { href: "/portal/tickets", label: "Tickets", icon: Ticket, roles: ["REQUESTER", "AGENT", "TENANT_ADMIN", "SUPER_ADMIN"] },
  { href: "/portal/kb", label: "Knowledge base", icon: BookOpen, roles: ["REQUESTER", "AGENT", "TENANT_ADMIN", "SUPER_ADMIN"] },
  { href: "/portal/forums", label: "Forums", icon: MessageSquare, roles: ["REQUESTER", "AGENT", "TENANT_ADMIN", "SUPER_ADMIN"] },
  { href: "/portal/reports", label: "Reports", icon: BarChart3, roles: ["TENANT_ADMIN", "AGENT", "SUPER_ADMIN"] },
  { href: "/portal/compliance", label: "DfE compliance", icon: ShieldCheck, roles: ["TENANT_ADMIN", "AGENT", "SUPER_ADMIN"] },
  { href: "/portal/finance", label: "Finance", icon: CreditCard, roles: ["TENANT_ADMIN", "AGENT", "SUPER_ADMIN"] },
  { href: "/portal/assets", label: "Assets", icon: Laptop, roles: ["TENANT_ADMIN", "AGENT", "SUPER_ADMIN"] },
  { href: "/portal/agent-tools", label: "Agent tools", icon: Wrench, roles: ["TENANT_ADMIN", "AGENT", "SUPER_ADMIN"] },
  { href: "/portal/admin/announcements", label: "Announcements", icon: Megaphone, roles: ["TENANT_ADMIN", "SUPER_ADMIN"] },
  { href: "/portal/admin/canned-responses", label: "Canned responses", icon: MessageCircle, roles: ["TENANT_ADMIN", "SUPER_ADMIN"] },
  { href: "/portal/admin/categories", label: "Categories", icon: Tag, roles: ["TENANT_ADMIN", "SUPER_ADMIN"] },
  { href: "/portal/admin/brands", label: "Brands", icon: Building2, roles: ["TENANT_ADMIN", "SUPER_ADMIN"] },
  { href: "/portal/admin/trash", label: "Trash", icon: Trash2, roles: ["TENANT_ADMIN", "SUPER_ADMIN"] },
  { href: "/portal/admin/users", label: "Users & Companies", icon: Users, roles: ["TENANT_ADMIN", "SUPER_ADMIN"] },
  { href: "/portal/admin/settings", label: "Settings", icon: Settings, roles: ["TENANT_ADMIN", "SUPER_ADMIN"] },
] as const satisfies { href: string; label: string; icon: LucideIcon; roles: readonly string[] | null }[];

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

/** Dark navy is the app-wide default sidebar — a school can override it with its own colour in Settings, but every sidebar is dark, so nav text is always light. */
const DEFAULT_SIDEBAR_COLOR = "#0f172a";

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

  return (
    <aside
      className="flex w-64 shrink-0 flex-col border-r border-black/10"
      style={{ backgroundColor: sidebarColor || DEFAULT_SIDEBAR_COLOR }}
    >
      <div className="border-b border-white/10 px-5 py-4">
        <div className="flex items-center gap-2 font-semibold text-white">
          {hasLogo ? (
            // eslint-disable-next-line @next/next/no-img-element -- small admin-uploaded logo, not worth next/image's remote-loader setup
            <img src="/api/tenant/logo" alt="" className="h-7 w-7 shrink-0 rounded-md object-contain" />
          ) : (
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-500 text-sm text-white">
              {appName.charAt(0).toUpperCase()}
            </span>
          )}
          {appName}
        </div>
        <p className="mt-1 truncate text-xs text-white/60">{tenantName}</p>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {links
          .filter((l) => !l.roles || (l.roles as readonly string[]).includes(role))
          .filter((l) => !disabled.has(l.href))
          .map((l) => {
            const active = l.href === "/portal" ? pathname === l.href : pathname.startsWith(l.href);
            const Icon = l.icon;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={clsx(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-indigo-600 text-white shadow-sm" : "text-white/70 hover:bg-white/10 hover:text-white",
                )}
              >
                <Icon size={17} className="shrink-0" />
                {l.label}
              </Link>
            );
          })}
      </nav>

      <div className="border-t border-white/10 p-3">
        <Link
          href="/portal/account/security"
          className="flex items-center gap-3 truncate rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white"
        >
          <UserIcon size={17} className="shrink-0" />
          <span className="truncate">{userName}</span>
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-white/50 hover:bg-white/10 hover:text-white/90"
        >
          <LogOut size={17} className="shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
