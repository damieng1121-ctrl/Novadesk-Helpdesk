import { z } from "zod";
import { requireRole, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function GET() {
  return withApiErrors(async () => {
    await requireRole(["SUPER_ADMIN"]);
    return prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        tenantId: true,
        tenant: { select: { name: true } },
        isActive: true,
        twoFactorEnabled: true,
        _count: { select: { accounts: true } },
      },
    });
  });
}

const createSchema = z.object({
  email: z.string().email().max(200),
  name: z.string().max(150).optional(),
  role: z.enum(["REQUESTER", "AGENT", "TENANT_ADMIN", "SUPER_ADMIN"]),
  tenantId: z.string().nullable(),
});

export async function POST(req: Request) {
  return withApiErrors(async () => {
    await requireRole(["SUPER_ADMIN"]);
    const body = createSchema.parse(await req.json());
    if (body.role === "SUPER_ADMIN" !== (body.tenantId === null)) {
      throw new AuthError("Super admins have no school; every other role needs one", 400);
    }
    const email = body.email.toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return prisma.user.update({
        where: { id: existing.id },
        data: { tenantId: body.tenantId, role: body.role, name: body.name ?? existing.name },
      });
    }
    return prisma.user.create({
      data: { email, name: body.name, role: body.role, tenantId: body.tenantId },
    });
  });
}
