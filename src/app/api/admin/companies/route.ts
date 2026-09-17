import { z } from "zod";
import { requireTenantSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/roles";

export async function GET() {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!isAdmin(session.user.role)) throw new AuthError("Only admins can view companies", 403);
    return prisma.company.findMany({
      where: { tenantId: session.user.tenantId },
      orderBy: { name: "asc" },
      include: { _count: { select: { users: true } } },
    });
  });
}

const createSchema = z.object({
  name: z.string().trim().min(2).max(150),
  domain: z.string().trim().max(150).optional().or(z.literal("")),
  urn: z.string().trim().max(20).optional().or(z.literal("")),
  phase: z.enum(["NURSERY", "PRIMARY", "SECONDARY", "ALL_THROUGH", "SPECIAL", "MULTI_ACADEMY_TRUST"]).optional(),
});

export async function POST(req: Request) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!isAdmin(session.user.role)) throw new AuthError("Only admins can add companies", 403);
    const body = createSchema.parse(await req.json());
    return prisma.company.create({
      data: {
        tenantId: session.user.tenantId,
        name: body.name,
        domain: body.domain || null,
        urn: body.urn || null,
        phase: body.phase,
      },
    });
  });
}
