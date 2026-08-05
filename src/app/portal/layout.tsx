import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PortalNav } from "@/components/portal-nav";
import { ActingBanner } from "@/components/acting-banner";

export default async function PortalLayout({ children }: LayoutProps<"/portal">) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.twoFactorEnabled && !session.user.twoFactorVerified) redirect("/verify-2fa");

  const isActing = session.user.role === "SUPER_ADMIN" && Boolean(session.user.actingTenantId);

  const tenant = session.user.tenantId
    ? await prisma.tenant.findUnique({
        where: { id: session.user.tenantId },
        select: { name: true, logoUrl: true, appName: true, sidebarColor: true, disabledNavItems: true },
      })
    : null;

  return (
    <div className="flex min-h-screen flex-1">
      <PortalNav
        // A super admin managing a school gets that school's full nav (as a
        // tenant admin would see it), not just the "Schools" platform link.
        role={isActing ? "TENANT_ADMIN" : session.user.role}
        userName={session.user.name ?? session.user.email ?? "Account"}
        tenantName={tenant?.name ?? "Novadesk platform admin"}
        appName={tenant?.appName ?? "Novadesk"}
        hasLogo={Boolean(tenant?.logoUrl)}
        sidebarColor={tenant?.sidebarColor ?? null}
        disabledNavItems={tenant?.disabledNavItems ?? []}
      />
      <div className="flex flex-1 flex-col">
        {isActing && <ActingBanner tenantName={tenant?.name ?? "this school"} />}
        <main className="flex-1 bg-slate-50 p-8">{children}</main>
      </div>
    </div>
  );
}
