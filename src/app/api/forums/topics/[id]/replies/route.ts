import { z } from "zod";
import { requireTenantSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { canManageTickets } from "@/lib/roles";

type Params = { params: Promise<{ id: string }> };

const bodySchema = z.object({ content: z.string().min(1).max(5000) });

export async function POST(req: Request, { params }: Params) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    const staff = canManageTickets(session.user.role);
    const { id } = await params;

    const topic = await prisma.forumTopic.findUnique({ where: { id }, include: { category: true } });
    if (!topic || topic.tenantId !== session.user.tenantId) throw new AuthError("Topic not found", 404);
    if (topic.category.visibility === "INTERNAL" && !staff) throw new AuthError("Topic not found", 404);

    const { content } = bodySchema.parse(await req.json());
    const reply = await prisma.forumReply.create({
      data: { topicId: id, authorId: session.user.id, content },
      include: { author: { select: { name: true, email: true, role: true } } },
    });
    await prisma.forumTopic.update({ where: { id }, data: { updatedAt: new Date() } });

    return reply;
  });
}
