import { redirect } from "next/navigation";
import Link from "next/link";
import { Eye } from "lucide-react";
import { auth } from "@/lib/auth";
import { PortalHome } from "@/components/portal-home";
import { isAdmin } from "@/lib/roles";

/** Lets an admin see exactly what a requester's portal home looks like — staff never land here in normal use, since /portal shows them the staff dashboard instead. */
export default async function PreviewHomePage() {
  const session = await auth();
  if (!session?.user.tenantId || !isAdmin(session.user.role)) redirect("/portal");

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm text-indigo-800 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-300">
        <Eye size={16} className="shrink-0" />
        <span>
          Previewing what a User sees as their portal home. Edit it from{" "}
          <Link href="/portal/admin/settings" className="font-medium underline">
            Settings → Self-service portal
          </Link>
          .
        </span>
      </div>
      <PortalHome tenantId={session.user.tenantId} />
    </div>
  );
}
