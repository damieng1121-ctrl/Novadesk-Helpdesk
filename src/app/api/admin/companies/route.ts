import { z } from "zod";
import { requireTenantSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/roles";

// Any signed-in tenant member can read the bare list (e.g. Reports' company
// filter, staff-only but not admin-only); only an admin gets the per-company
// user count, which isn't needed outside the management page.
export async function GET() {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    const admin = isAdmin(session.user.role);
    return prisma.company.findMany({
      where: { tenantId: session.user.tenantId },
      orderBy: { name: "asc" },
      include: admin ? { _count: { select: { users: true } } } : undefined,
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
