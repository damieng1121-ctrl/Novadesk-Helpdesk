import { requireMisSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { MessagesClient } from "./messages-client";

export default async function MessagesPage() {
  const session = await requireMisSession();

  const [formGroups, pupils] = await Promise.all([
    prisma.formGroup.findMany({
      where: { tenantId: session.user.tenantId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.pupil.findMany({
      where: { tenantId: session.user.tenantId, isActive: true, isDeleted: false },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    }),
  ]);

  return <MessagesClient formGroups={formGroups} pupils={pupils} />;
}
