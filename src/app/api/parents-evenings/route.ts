import { z } from "zod";
import { requireMisSession } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function GET() {
  return withApiErrors(async () => {
    const session = await requireMisSession();
    return prisma.parentsEveningEvent.findMany({
      where: { tenantId: session.user.tenantId },
      orderBy: { date: "desc" },
      include: { _count: { select: { slots: true } } },
    });
  });
}

const createSchema = z.object({
  title: z.string().min(1).max(150),
  date: z.coerce.date(),
  startTime: z.string().min(1).max(5),
  endTime: z.string().min(1).max(5),
  slotMinutes: z.number().int().min(1).max(120).default(10),
  formGroupIds: z.array(z.string()).default([]),
  bookingOpensAt: z.coerce.date().optional().nullable(),
  bookingClosesAt: z.coerce.date().optional().nullable(),
  locationNote: z.string().max(500).optional().nullable(),
});

export async function POST(req: Request) {
  return withApiErrors(async () => {
    const session = await requireMisSession();
    const body = createSchema.parse(await req.json());

    return prisma.parentsEveningEvent.create({
      data: { ...body, tenantId: session.user.tenantId, createdById: session.user.id },
    });
  });
}
