"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import type { Role } from "@prisma/client";
import clsx from "clsx";
import { NotificationBell } from "@/components/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  LayoutDashboard,
  Ticket,
  BookOpen,
  MessageSquare,
  BarChart3,
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
  ChevronDown,
  KeyRound,
  ListChecks,
  CalendarDays,
  type LucideIcon,
} from "lucide-react";

type Group = "core" | "tools" | "admin";

// One shared helpdesk — every signed-in role sees the same nav, scoped by
// what they're allowed to do (a plain User only sees Tickets/KB/Forums; an
// Admin/Technician sees the rest). `group` decides where each item lands in
// the top bar: "core" items are always direct links, "tools"/"admin" items
// collapse into their own dropdown once there's more than one of them.
const links = [
  { href: "/portal", label: "Dashboard", icon: LayoutDashboard, roles: null, group: "core" },
  { href: "/portal/tickets", label: "Tickets", icon: Ticket, roles: ["REQUESTER", "AGENT", "TENANT_ADMIN", "SUPER_ADMIN"], group: "core" },
  { href: "/portal/kb", label: "Knowledge base", icon: BookOpen, roles: ["REQUESTER", "AGENT", "TENANT_ADMIN", "SUPER_ADMIN"], group: "core" },
  { href: "/portal/forums", label: "Forums", icon: MessageSquare, roles: ["REQUESTER", "AGENT", "TENANT_ADMIN", "SUPER_ADMIN"], group: "core" },
  { href: "/portal/reports", label: "Reports", icon: BarChart3, roles: ["TENANT_ADMIN", "AGENT", "SUPER_ADMIN"], group: "core" },
  { href: "/portal/finance", label: "Finance", icon: CreditCard, roles: ["TENANT_ADMIN", "AGENT", "SUPER_ADMIN"], group: "tools" },
  { href: "/portal/assets", label: "Assets", icon: Laptop, roles: ["TENANT_ADMIN", "AGENT", "SUPER_ADMIN"], group: "tools" },
  { href: "/portal/agent-tools", label: "Agent tools", icon: Wrench, roles: ["TENANT_ADMIN", "AGENT", "SUPER_ADMIN"], group: "tools" },
  { href: "/portal/passwords", label: "Passwords", icon: KeyRound, roles: ["TENANT_ADMIN", "AGENT", "SUPER_ADMIN"], group: "tools" },
  { href: "/portal/todos", label: "To-do list", icon: ListChecks, roles: ["TENANT_ADMIN", "AGENT", "SUPER_ADMIN"], group: "tools" },
  { href: "/portal/admin/announcements", label: "Announcements", icon: Megaphone, roles: ["TENANT_ADMIN", "SUPER_ADMIN"], group: "admin" },
  { href: "/portal/admin/canned-responses", label: "Canned responses", icon: MessageCircle, roles: ["TENANT_ADMIN", "SUPER_ADMIN"], group: "admin" },
  { href: "/portal/admin/categories", label: "Categories", icon: Tag, roles: ["TENANT_ADMIN", "SUPER_ADMIN"], group: "admin" },
  { href: "/portal/admin/brands", label: "Brands", icon: Building2, roles: ["TENANT_ADMIN", "SUPER_ADMIN"], group: "admin" },
  { href: "/portal/admin/holidays", label: "Holidays", icon: CalendarDays, roles: ["TENANT_ADMIN", "SUPER_ADMIN"], group: "admin" },
  { href: "/portal/admin/trash", label: "Trash", icon: Trash2, roles: ["TENANT_ADMIN", "SUPER_ADMIN"], group: "admin" },
  { href: "/portal/admin/users", label: "Users & Companies", icon: Users, roles: ["TENANT_ADMIN", "SUPER_ADMIN"], group: "admin" },
  { href: "/portal/admin/settings", label: "Settings", icon: Settings, roles: ["TENANT_ADMIN", "SUPER_ADMIN"], group: "admin" },
] as const satisfies { href: string; label: string; icon: LucideIcon; roles: readonly string[] | null; group: Group }[];

/** Modules a school can hide entirely if they don't use them — see /portal/admin/settings. Core nav (dashboard/tickets/KB/settings/users/trash) always shows. */
export const TOGGLEABLE_NAV_ITEMS = [
  { href: "/portal/forums", label: "Forums" },
  { href: "/portal/reports", label: "Reports" },
  { href: "/portal/finance", label: "Finance" },
  { href: "/portal/assets", label: "Assets" },
  { href: "/portal/agent-tools", label: "Agent tools" },
  { href: "/portal/passwords", label: "Passwords" },
  { href: "/portal/todos", label: "To-do list" },
  { href: "/portal/admin/announcements", label: "Announcements" },
  { href: "/portal/admin/canned-responses", label: "Canned responses" },
] as const;

/** Dark navy is the app-wide default top bar — a school can override it with its own colour in Settings, but every bar is dark, so nav text is always light. */
const DEFAULT_NAV_COLOR = "#0f172a";

function NavDropdown({
  label,
  items,
  active,
  onNavigate,
}: {
  label: string;
  items: { href: string; label: string; icon: LucideIcon }[];
  active: boolean;
  onNavigate: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          "flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          active ? "bg-indigo-600 text-white shadow-sm" : "text-white/70 hover:bg-white/10 hover:text-white",
        )}
      >
        {label}
        <ChevronDown size={15} className={clsx("transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg dark:border-slate-800 dark:bg-slate-900">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => {
                  setOpen(false);
                  onNavigate();
                }}
                className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <Icon size={16} className="shrink-0 text-slate-500 dark:text-slate-500" />
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function PortalNav({
  role,
  userName,
  appName = "Novadesk",
  hasLogo = false,
  sidebarColor,
  disabledNavItems = [],
}: {
  role: Role;
  userName: string;
  appName?: string;
  hasLogo?: boolean;
  sidebarColor?: string | null;
  disabledNavItems?: string[];
}) {
  const pathname = usePathname();
  const disabled = new Set(disabledNavItems);

  const visible = links.filter((l) => (!l.roles || (l.roles as readonly string[]).includes(role)) && !disabled.has(l.href));
  const core = visible.filter((l) => l.group === "core");
  const tools = visible.filter((l) => l.group === "tools");
  const admin = visible.filter((l) => l.group === "admin");

  const isActive = (href: string) => (href === "/portal" ? pathname === href : pathname.startsWith(href));

  return (
    <header
      className="flex h-14 shrink-0 items-center gap-1 border-b border-black/10 px-4"
      style={{ backgroundColor: sidebarColor || DEFAULT_NAV_COLOR }}
    >
      <div className="flex items-center gap-2 pr-4 font-semibold text-white">
        {hasLogo ? (
          // eslint-disable-next-line @next/next/no-img-element -- small admin-uploaded logo, not worth next/image's remote-loader setup
          <img src="/api/tenant/logo" alt="" className="h-7 w-7 shrink-0 rounded-md object-contain" />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-500 text-sm text-white">
            {appName.charAt(0).toUpperCase()}
          </span>
        )}
        <span className="hidden sm:inline">{appName}</span>
      </div>

      {/*
        No overflow-x-auto here on purpose: setting overflow-x without
        overflow-y makes the browser implicitly clip the y-axis too (per the
        CSS overflow spec), which cut off the Tools/Admin dropdown panels
        below this bar entirely. The dropdown grouping already keeps the
        core row short enough that this doesn't need scroll handling on a
        normal desktop width; narrow-viewport nav is a separate, open item.
      */}
      <nav className="flex flex-1 items-center gap-1">
        {core.map((l) => {
          const Icon = l.icon;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={clsx(
                "flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive(l.href) ? "bg-indigo-600 text-white shadow-sm" : "text-white/70 hover:bg-white/10 hover:text-white",
              )}
            >
              <Icon size={16} className="shrink-0" />
              {l.label}
            </Link>
          );
        })}
        {tools.length > 0 && (
          <NavDropdown label="Tools" items={tools} active={tools.some((l) => isActive(l.href))} onNavigate={() => {}} />
        )}
        {admin.length > 0 && (
          <NavDropdown label="Admin" items={admin} active={admin.some((l) => isActive(l.href))} onNavigate={() => {}} />
        )}
      </nav>

      <div className="flex items-center gap-1">
        <ThemeToggle className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white" />
        <NotificationBell />
        <Link
          href="/portal/account/security"
          className="flex items-center gap-2 truncate rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white"
        >
          <UserIcon size={16} className="shrink-0" />
          <span className="hidden max-w-[10rem] truncate sm:inline">{userName}</span>
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/50 hover:bg-white/10 hover:text-white/90"
        >
          <LogOut size={16} className="shrink-0" />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    </header>
  );
}
