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
  Settings,
  School,
  User as UserIcon,
  LogOut,
  GraduationCap,
  CalendarCheck,
  HeartHandshake,
  ClipboardList,
  Target,
  PartyPopper,
  Utensils,
  IdCard,
  ClipboardPlus,
  CalendarClock,
  Send,
  FileSpreadsheet,
  type LucideIcon,
} from "lucide-react";
import { canAccessMis } from "@/lib/roles";

type NavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: readonly string[] | null;
  group: "helpdesk" | "mis";
  /** MIS links are additionally gated by canAccessMis(role, isTeacher) on top of `roles`. */
  requiresMis?: boolean;
};

// Tickets/KB/compliance/admin are all tenant-scoped, so they only make sense
// for staff who actually belong to a school — a platform SUPER_ADMIN (who
// has no tenantId) sees "Schools" instead.
const links: NavLink[] = [
  { href: "/portal", label: "Dashboard", icon: LayoutDashboard, roles: null, group: "helpdesk" },
  { href: "/portal/tickets", label: "Tickets", icon: Ticket, roles: ["REQUESTER", "AGENT", "TENANT_ADMIN"], group: "helpdesk" },
  { href: "/portal/kb", label: "Knowledge base", icon: BookOpen, roles: ["REQUESTER", "AGENT", "TENANT_ADMIN"], group: "helpdesk" },
  { href: "/portal/forums", label: "Forums", icon: MessageSquare, roles: ["REQUESTER", "AGENT", "TENANT_ADMIN"], group: "helpdesk" },
  { href: "/portal/reports", label: "Reports", icon: BarChart3, roles: ["TENANT_ADMIN", "AGENT"], group: "helpdesk" },
  { href: "/portal/compliance", label: "DfE compliance", icon: ShieldCheck, roles: ["TENANT_ADMIN", "AGENT"], group: "helpdesk" },
  { href: "/portal/finance", label: "Finance", icon: CreditCard, roles: ["TENANT_ADMIN", "AGENT"], group: "helpdesk" },
  { href: "/portal/assets", label: "Assets", icon: Laptop, roles: ["TENANT_ADMIN", "AGENT"], group: "helpdesk" },
  { href: "/portal/agent-tools", label: "Agent tools", icon: Wrench, roles: ["TENANT_ADMIN", "AGENT"], group: "helpdesk" },
  { href: "/portal/admin/announcements", label: "Announcements", icon: Megaphone, roles: ["TENANT_ADMIN"], group: "helpdesk" },
  { href: "/portal/admin/canned-responses", label: "Canned responses", icon: MessageCircle, roles: ["TENANT_ADMIN"], group: "helpdesk" },
  { href: "/portal/admin/trash", label: "Trash", icon: Trash2, roles: ["TENANT_ADMIN"], group: "helpdesk" },
  { href: "/portal/admin/users", label: "Users", icon: Users, roles: ["TENANT_ADMIN"], group: "helpdesk" },
  { href: "/portal/admin/settings", label: "Settings", icon: Settings, roles: ["TENANT_ADMIN"], group: "helpdesk" },
  { href: "/portal/super-admin", label: "Schools", icon: School, roles: ["SUPER_ADMIN"], group: "helpdesk" },

  // --- School MIS ---
  { href: "/portal/pupils", label: "Pupils", icon: GraduationCap, roles: null, group: "mis", requiresMis: true },
  { href: "/portal/attendance", label: "Attendance", icon: CalendarCheck, roles: null, group: "mis", requiresMis: true },
  { href: "/portal/behaviour", label: "Behaviour", icon: HeartHandshake, roles: null, group: "mis", requiresMis: true },
  { href: "/portal/send", label: "SEND", icon: ClipboardPlus, roles: null, group: "mis", requiresMis: true },
  { href: "/portal/assessment", label: "Assessment", icon: ClipboardList, roles: null, group: "mis", requiresMis: true },
  { href: "/portal/targets", label: "Targets", icon: Target, roles: null, group: "mis", requiresMis: true },
  { href: "/portal/interventions", label: "Interventions", icon: Target, roles: null, group: "mis", requiresMis: true },
  { href: "/portal/clubs", label: "Clubs", icon: PartyPopper, roles: null, group: "mis", requiresMis: true },
  { href: "/portal/meals", label: "Meals", icon: Utensils, roles: null, group: "mis", requiresMis: true },
  { href: "/portal/staff", label: "Staff records", icon: IdCard, roles: ["TENANT_ADMIN"], group: "mis" },
  { href: "/portal/parents-evenings", label: "Parents' evenings", icon: CalendarClock, roles: null, group: "mis", requiresMis: true },
  { href: "/portal/messages", label: "Messages", icon: Send, roles: null, group: "mis", requiresMis: true },
  { href: "/portal/census", label: "Census readiness", icon: FileSpreadsheet, roles: ["TENANT_ADMIN"], group: "mis" },
];

/** Modules a school can hide entirely if they don't use them — see /portal/admin/settings. Core nav (dashboard/tickets/KB/settings/users/trash) always shows. */
export const TOGGLEABLE_NAV_ITEMS = [
  { href: "/portal/forums", label: "Forums" },
  { href: "/portal/reports", label: "Reports" },
  { href: "/portal/finance", label: "Finance" },
  { href: "/portal/assets", label: "Assets" },
  { href: "/portal/agent-tools", label: "Agent tools" },
  { href: "/portal/admin/announcements", label: "Announcements" },
  { href: "/portal/admin/canned-responses", label: "Canned responses" },
  { href: "/portal/clubs", label: "Clubs" },
  { href: "/portal/meals", label: "Meals" },
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
  isTeacher = false,
}: {
  role: Role;
  userName: string;
  tenantName: string;
  appName?: string;
  hasLogo?: boolean;
  sidebarColor?: string | null;
  disabledNavItems?: string[];
  isTeacher?: boolean;
}) {
  const pathname = usePathname();
  const disabled = new Set(disabledNavItems);

  const visible = links
    .filter((l) => !l.roles || (l.roles as readonly string[]).includes(role))
    .filter((l) => !l.requiresMis || canAccessMis(role, isTeacher))
    .filter((l) => !disabled.has(l.href));
  const helpdeskLinks = visible.filter((l) => l.group === "helpdesk");
  const misLinks = visible.filter((l) => l.group === "mis");

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

      <nav className="flex-1 space-y-4 overflow-y-auto p-3">
        <div className="space-y-1">
          {helpdeskLinks.map((l) => (
            <NavItem key={l.href} link={l} pathname={pathname} />
          ))}
        </div>
        {misLinks.length > 0 && (
          <div className="space-y-1">
            <p className="px-3 pb-1 text-[11px] font-semibold tracking-wide text-white/40 uppercase">School MIS</p>
            {misLinks.map((l) => (
              <NavItem key={l.href} link={l} pathname={pathname} />
            ))}
          </div>
        )}
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

function NavItem({ link, pathname }: { link: NavLink; pathname: string }) {
  const active = link.href === "/portal" ? pathname === link.href : pathname.startsWith(link.href);
  const Icon = link.icon;
  return (
    <Link
      href={link.href}
      className={clsx(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active ? "bg-indigo-600 text-white shadow-sm" : "text-white/70 hover:bg-white/10 hover:text-white",
      )}
    >
      <Icon size={17} className="shrink-0" />
      {link.label}
    </Link>
  );
}
