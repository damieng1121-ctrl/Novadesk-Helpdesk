import { z } from "zod";
import { requireTenantSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { canManageTickets } from "@/lib/roles";

export async function GET() {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!canManageTickets(session.user.role)) throw new AuthError("Staff only", 403);
    return prisma.financeRecord.findMany({
      where: { tenantId: session.user.tenantId, isDeleted: false },
      orderBy: { requestDate: "desc" },
      include: { requestedBy: { select: { name: true, email: true } } },
    });
  });
}

const createSchema = z.object({
  poNumber: z.string().min(1).max(60),
  description: z.string().min(1).max(2000),
  amountPence: z.number().int().min(0),
  vendor: z.string().min(1).max(150),
});

export async function POST(req: Request) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!canManageTickets(session.user.role)) throw new AuthError("Staff only", 403);
    const body = createSchema.parse(await req.json());

    return prisma.financeRecord.create({
      data: { ...body, tenantId: session.user.tenantId, requestedById: session.user.id },
      include: { requestedBy: { select: { name: true, email: true } } },
    });
  });
}
