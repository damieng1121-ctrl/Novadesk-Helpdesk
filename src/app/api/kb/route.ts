import { z } from "zod";
import { requireTenantSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { canManageTickets } from "@/lib/roles";

function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

export async function GET(req: Request) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    const staff = canManageTickets(session.user.role);
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");

    return prisma.kbArticle.findMany({
      where: {
        tenantId: session.user.tenantId,
        status: staff ? undefined : "PUBLISHED",
        ...(q
          ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { content: { contains: q, mode: "insensitive" } }] }
          : {}),
      },
      orderBy: { updatedAt: "desc" },
      include: { category: true, author: { select: { name: true, email: true } } },
    });
  });
}

const createSchema = z.object({
  title: z.string().min(3).max(150),
  content: z.string().min(1),
  categoryId: z.string().optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
});

export async function POST(req: Request) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!canManageTickets(session.user.role)) throw new AuthError("Only staff can create articles", 403);
    const body = createSchema.parse(await req.json());
    const tenantId = session.user.tenantId;

    let slug = slugify(body.title);
    const clash = await prisma.kbArticle.findUnique({ where: { tenantId_slug: { tenantId, slug } } });
    if (clash) slug = `${slug}-${Date.now().toString(36)}`;

    return prisma.kbArticle.create({
      data: {
        tenantId,
        title: body.title,
        slug,
        content: body.content,
        categoryId: body.categoryId,
        status: body.status ?? "DRAFT",
        authorId: session.user.id,
      },
    });
  });
}
