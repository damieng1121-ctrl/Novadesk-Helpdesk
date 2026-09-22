import { z } from "zod";
import { requireTenantSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { canManageTickets, isAdmin } from "@/lib/roles";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, { params }: Params) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    const staff = canManageTickets(session.user.role);
    const { slug } = await params;

    const article = await prisma.kbArticle.findUnique({
      where: { tenantId_slug: { tenantId: session.user.tenantId, slug } },
      include: { category: true, author: { select: { name: true, email: true } }, attachments: true },
    });
    if (!article || article.isDeleted || (!staff && article.status !== "PUBLISHED")) {
      throw new AuthError("Article not found", 404);
    }

    if (!staff) {
      await prisma.kbArticle.update({ where: { id: article.id }, data: { viewCount: { increment: 1 } } });
    }

    return article;
  });
}

const updateSchema = z.object({
  title: z.string().min(3).max(150).optional(),
  content: z.string().min(1).optional(),
  categoryId: z.string().nullable().optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
  isDeleted: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: Params) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!canManageTickets(session.user.role)) throw new AuthError("Only staff can edit articles", 403);
    const { slug } = await params;

    const article = await prisma.kbArticle.findUnique({
      where: { tenantId_slug: { tenantId: session.user.tenantId, slug } },
    });
    if (!article) throw new AuthError("Article not found", 404);

    const body = updateSchema.parse(await req.json());
    return prisma.kbArticle.update({ where: { id: article.id }, data: body });
  });
}

/** Permanent, unrecoverable delete — only ever reachable from the trash bin on an already soft-deleted article. */
export async function DELETE(_req: Request, { params }: Params) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!isAdmin(session.user.role)) throw new AuthError("Only admins can permanently delete articles", 403);
    const { slug } = await params;

    const article = await prisma.kbArticle.findUnique({
      where: { tenantId_slug: { tenantId: session.user.tenantId, slug } },
    });
    if (!article) throw new AuthError("Article not found", 404);
    if (!article.isDeleted) throw new AuthError("Move to trash before permanently deleting", 400);

    await prisma.kbArticle.delete({ where: { id: article.id } });
    return { ok: true };
  });
}
