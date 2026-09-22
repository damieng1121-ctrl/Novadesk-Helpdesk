import { requireTenantSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { canManageTickets } from "@/lib/roles";
import { saveUpload, UploadTooLargeError } from "@/lib/storage";

type Params = { params: Promise<{ slug: string }> };

export async function POST(req: Request, { params }: Params) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!canManageTickets(session.user.role)) throw new AuthError("Only staff can attach files to articles", 403);
    const { slug } = await params;

    const article = await prisma.kbArticle.findUnique({
      where: { tenantId_slug: { tenantId: session.user.tenantId, slug } },
    });
    if (!article) throw new AuthError("Article not found", 404);

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new AuthError("No file provided", 400);

    let saved;
    try {
      const bytes = Buffer.from(await file.arrayBuffer());
      saved = await saveUpload(session.user.tenantId, article.id, file.name, bytes);
    } catch (err) {
      if (err instanceof UploadTooLargeError) throw new AuthError(err.message, 413);
      throw err;
    }

    return prisma.kbAttachment.create({
      data: {
        articleId: article.id,
        fileName: file.name,
        url: saved.key,
        fileSize: saved.size,
        contentType: file.type || null,
      },
    });
  });
}
