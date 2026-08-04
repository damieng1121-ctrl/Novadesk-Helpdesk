import { z } from "zod";
import { requireTenantSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/roles";

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);
}

export async function GET() {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    return prisma.kbCategory.findMany({ where: { tenantId: session.user.tenantId }, orderBy: { name: "asc" } });
  });
}

const createSchema = z.object({ name: z.string().min(1).max(80) });

export async function POST(req: Request) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!isAdmin(session.user.role)) throw new AuthError("Only admins can manage KB categories", 403);
    const { name } = createSchema.parse(await req.json());
    return prisma.kbCategory.create({
      data: { tenantId: session.user.tenantId, name, slug: slugify(name) },
    });
  });
}
