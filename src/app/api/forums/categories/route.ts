import { z } from "zod";
import { requireTenantSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { canManageTickets, isAdmin } from "@/lib/roles";

export async function GET() {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    const staff = canManageTickets(session.user.role);

    const categories = await prisma.forumCategory.findMany({
      where: { tenantId: session.user.tenantId, ...(staff ? {} : { visibility: "PUBLIC" }) },
      orderBy: { order: "asc" },
      include: { _count: { select: { topics: true } } },
    });
    return categories;
  });
}

const createSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(300).optional(),
  visibility: z.enum(["PUBLIC", "INTERNAL"]).optional(),
});

export async function POST(req: Request) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!isAdmin(session.user.role)) throw new AuthError("Only admins can create forum categories", 403);
    const body = createSchema.parse(await req.json());
    return prisma.forumCategory.create({ data: { ...body, tenantId: session.user.tenantId } });
  });
}
