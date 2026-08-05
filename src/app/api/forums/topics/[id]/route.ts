import { requireTenantSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { canManageTickets } from "@/lib/roles";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    const staff = canManageTickets(session.user.role);
    const { id } = await params;

    const topic = await prisma.forumTopic.findUnique({
      where: { id },
      include: {
        category: true,
        author: { select: { name: true, email: true } },
        replies: {
          orderBy: { createdAt: "asc" },
          include: { author: { select: { name: true, email: true, role: true } } },
        },
      },
    });
    if (!topic || topic.tenantId !== session.user.tenantId) throw new AuthError("Topic not found", 404);
    if (topic.category.visibility === "INTERNAL" && !staff) throw new AuthError("Topic not found", 404);

    await prisma.forumTopic.update({ where: { id }, data: { views: { increment: 1 } } });

    return topic;
  });
}
