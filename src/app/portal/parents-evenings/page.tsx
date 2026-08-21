import { requireMisSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { ParentsEveningsClient } from "./parents-evenings-client";

export default async function ParentsEveningsPage() {
  const session = await requireMisSession();

  const [formGroups, teachers] = await Promise.all([
    prisma.formGroup.findMany({
      where: { tenantId: session.user.tenantId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, yearGroup: true },
    }),
    prisma.user.findMany({
      where: { tenantId: session.user.tenantId, isTeacher: true, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
  ]);

  return <ParentsEveningsClient formGroups={formGroups} teachers={teachers} />;
}
