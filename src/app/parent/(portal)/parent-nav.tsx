"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import clsx from "clsx";
import { LayoutDashboard, Mail, CalendarClock, User as UserIcon, LogOut } from "lucide-react";

const links = [
  { href: "/parent", label: "Home", icon: LayoutDashboard },
  { href: "/parent/messages", label: "Messages", icon: Mail },
  { href: "/parent/parents-evenings", label: "Parents' evenings", icon: CalendarClock },
];

export function ParentNav({ userName }: { userName: string }) {
  const pathname = usePathname();

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-black/10 bg-slate-900">
      <div className="border-b border-white/10 px-5 py-4">
        <div className="flex items-center gap-2 font-semibold text-white">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-500 text-sm text-white">N</span>
          Novadesk
        </div>
        <p className="mt-1 truncate text-xs text-white/60">Parent portal</p>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {links.map((l) => {
          const active = l.href === "/parent" ? pathname === l.href : pathname.startsWith(l.href);
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
        <div className="flex items-center gap-3 truncate rounded-lg px-3 py-2 text-sm text-white/70">
          <UserIcon size={17} className="shrink-0" />
          <span className="truncate">{userName}</span>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/parent/login" })}
          className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-white/50 hover:bg-white/10 hover:text-white/90"
        >
          <LogOut size={17} className="shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
