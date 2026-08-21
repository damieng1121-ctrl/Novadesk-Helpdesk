import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ParentNav } from "./parent-nav";

export default async function ParentPortalLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/parent/login");
  if (session.user.role !== "PARENT") redirect("/portal");

  return (
    <div className="flex min-h-screen flex-1">
      <ParentNav userName={session.user.name ?? session.user.email ?? "Account"} />
      <main className="flex-1 bg-slate-50 p-8">{children}</main>
    </div>
  );
}
