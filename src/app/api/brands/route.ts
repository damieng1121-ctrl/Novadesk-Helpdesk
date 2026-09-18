import { z } from "zod";
import { requireTenantSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/roles";

export async function GET() {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    return prisma.brand.findMany({
      where: { tenantId: session.user.tenantId },
      orderBy: { name: "asc" },
      include: isAdmin(session.user.role)
        ? { technicians: { select: { id: true, name: true, email: true } } }
        : undefined,
    });
  });
}

const createSchema = z.object({
  name: z.string().min(1).max(80),
  supportEmail: z.string().trim().toLowerCase().email().max(200).optional(),
});

export async function POST(req: Request) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!isAdmin(session.user.role)) throw new AuthError("Only admins can manage brands", 403);
    const body = createSchema.parse(await req.json());
    return prisma.brand.create({ data: { ...body, tenantId: session.user.tenantId } });
  });
}
