import { z } from "zod";
import { requireTenantSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { canManageTickets } from "@/lib/roles";

export async function GET() {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!canManageTickets(session.user.role)) throw new AuthError("Staff only", 403);
    return prisma.asset.findMany({
      where: { tenantId: session.user.tenantId, isDeleted: false },
      orderBy: { createdAt: "desc" },
      include: { assignedTo: { select: { name: true, email: true } } },
    });
  });
}

const createSchema = z.object({
  tag: z.string().min(1).max(60),
  name: z.string().min(1).max(150),
  model: z.string().max(100).optional(),
  serialNumber: z.string().max(100).optional(),
  assignedToId: z.string().optional(),
  status: z.enum(["ACTIVE", "IN_REPAIR", "RETIRED", "LOST"]).optional(),
  purchaseDate: z.string().optional(),
  warrantyExpiry: z.string().optional(),
});

export async function POST(req: Request) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!canManageTickets(session.user.role)) throw new AuthError("Staff only", 403);
    const body = createSchema.parse(await req.json());

    return prisma.asset.create({
      data: {
        ...body,
        tenantId: session.user.tenantId,
        purchaseDate: body.purchaseDate ? new Date(body.purchaseDate) : undefined,
        warrantyExpiry: body.warrantyExpiry ? new Date(body.warrantyExpiry) : undefined,
      },
      include: { assignedTo: { select: { name: true, email: true } } },
    });
  });
}
