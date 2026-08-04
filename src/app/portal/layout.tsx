import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PortalNav } from "@/components/portal-nav";

export default async function PortalLayout({ children }: LayoutProps<"/portal">) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.twoFactorEnabled && !session.user.twoFactorVerified) redirect("/verify-2fa");

  const tenant = session.user.tenantId
    ? await prisma.tenant.findUnique({ where: { id: session.user.tenantId }, select: { name: true } })
    : null;

  return (
    <div className="flex min-h-screen flex-1">
      <PortalNav
        role={session.user.role}
        userName={session.user.name ?? session.user.email ?? "Account"}
        tenantName={tenant?.name ?? "Novadesk platform admin"}
      />
      <main className="flex-1 bg-slate-50 p-8">{children}</main>
    </div>
  );
}
