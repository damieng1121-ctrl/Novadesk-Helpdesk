import { z } from "zod";
import { requireTenantSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { canManageTickets } from "@/lib/roles";

export async function GET(req: Request) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    const staff = canManageTickets(session.user.role);
    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get("categoryId");
    if (!categoryId) throw new AuthError("categoryId is required", 400);

    const category = await prisma.forumCategory.findUnique({ where: { id: categoryId } });
    if (!category || category.tenantId !== session.user.tenantId) throw new AuthError("Category not found", 404);
    if (category.visibility === "INTERNAL" && !staff) throw new AuthError("Category not found", 404);

    return prisma.forumTopic.findMany({
      where: { categoryId },
      orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
      include: {
        author: { select: { name: true, email: true } },
        _count: { select: { replies: true } },
      },
    });
  });
}

const createSchema = z.object({
  categoryId: z.string(),
  title: z.string().min(3).max(150),
  content: z.string().min(1).max(5000),
});

export async function POST(req: Request) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    const staff = canManageTickets(session.user.role);
    const body = createSchema.parse(await req.json());

    const category = await prisma.forumCategory.findUnique({ where: { id: body.categoryId } });
    if (!category || category.tenantId !== session.user.tenantId) throw new AuthError("Category not found", 404);
    if (category.visibility === "INTERNAL" && !staff) throw new AuthError("Category not found", 404);

    return prisma.forumTopic.create({
      data: {
        tenantId: session.user.tenantId,
        categoryId: body.categoryId,
        title: body.title,
        content: body.content,
        authorId: session.user.id,
      },
      include: { author: { select: { name: true, email: true } } },
    });
  });
}
