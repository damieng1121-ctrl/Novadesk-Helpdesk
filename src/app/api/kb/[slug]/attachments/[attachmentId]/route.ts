import { requireTenantSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { canManageTickets } from "@/lib/roles";
import { deleteUpload, readUpload } from "@/lib/storage";

type Params = { params: Promise<{ slug: string; attachmentId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const session = await requireTenantSession().catch(() => null);
  if (!session) return new Response("Not authenticated", { status: 401 });

  const { slug, attachmentId } = await params;
  const staff = canManageTickets(session.user.role);

  const article = await prisma.kbArticle.findUnique({
    where: { tenantId_slug: { tenantId: session.user.tenantId, slug } },
  });
  if (!article || article.isDeleted) return new Response("Not found", { status: 404 });
  if (!staff && article.status !== "PUBLISHED") return new Response("Not found", { status: 404 });

  const attachment = await prisma.kbAttachment.findUnique({ where: { id: attachmentId } });
  if (!attachment || attachment.articleId !== article.id) return new Response("Not found", { status: 404 });

  const bytes = await readUpload(attachment.url).catch(() => null);
  if (!bytes) return new Response("File not found", { status: 404 });

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": attachment.contentType || "application/octet-stream",
      "Content-Disposition": `inline; filename="${attachment.fileName.replace(/"/g, "")}"`,
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}

export async function DELETE(_req: Request, { params }: Params) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!canManageTickets(session.user.role)) throw new AuthError("Only staff can remove attachments", 403);
    const { slug, attachmentId } = await params;

    const article = await prisma.kbArticle.findUnique({
      where: { tenantId_slug: { tenantId: session.user.tenantId, slug } },
    });
    if (!article) throw new AuthError("Article not found", 404);

    const attachment = await prisma.kbAttachment.findUnique({ where: { id: attachmentId } });
    if (!attachment || attachment.articleId !== article.id) throw new AuthError("Attachment not found", 404);

    await deleteUpload(attachment.url);
    await prisma.kbAttachment.delete({ where: { id: attachmentId } });
    return { ok: true };
  });
}
