import { z } from "zod";
import { requireTenantSession } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/roles";
import { AuthError } from "@/lib/session";

export async function GET() {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    return prisma.category.findMany({
      where: { tenantId: session.user.tenantId },
      orderBy: { name: "asc" },
    });
  });
}

const createSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(300).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export async function POST(req: Request) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!isAdmin(session.user.role)) throw new AuthError("Only admins can manage categories", 403);
    const body = createSchema.parse(await req.json());
    return prisma.category.create({
      data: { ...body, tenantId: session.user.tenantId },
    });
  });
}
