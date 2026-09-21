import { requireTenantSession } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function GET() {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      prisma.notification.count({ where: { userId: session.user.id, isRead: false } }),
    ]);
    return { notifications, unreadCount };
  });
}

export async function POST() {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    await prisma.notification.updateMany({
      where: { userId: session.user.id, isRead: false },
      data: { isRead: true },
    });
    return { ok: true };
  });
}
