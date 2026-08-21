import { z } from "zod";
import { requireMisSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  return withApiErrors(async () => {
    const session = await requireMisSession();
    const { id } = await params;

    const event = await prisma.parentsEveningEvent.findUnique({ where: { id } });
    if (!event || event.tenantId !== session.user.tenantId) throw new AuthError("Not found", 404);

    const slots = await prisma.appointmentSlot.findMany({
      where: { tenantId: session.user.tenantId, eventId: id },
      orderBy: [{ teacherId: "asc" }, { startTime: "asc" }],
      include: {
        teacher: { select: { id: true, name: true, email: true } },
        pupil: { select: { id: true, firstName: true, lastName: true } },
        guardian: { select: { id: true, name: true, email: true } },
      },
    });

    return { event, slots };
  });
}

const updateSchema = z.object({
  title: z.string().min(1).max(150).optional(),
  date: z.coerce.date().optional(),
  startTime: z.string().min(1).max(5).optional(),
  endTime: z.string().min(1).max(5).optional(),
  slotMinutes: z.number().int().min(1).max(120).optional(),
  formGroupIds: z.array(z.string()).optional(),
  bookingOpensAt: z.coerce.date().optional().nullable(),
  bookingClosesAt: z.coerce.date().optional().nullable(),
  locationNote: z.string().max(500).optional().nullable(),
});

export async function PATCH(req: Request, { params }: Params) {
  return withApiErrors(async () => {
    const session = await requireMisSession();
    const { id } = await params;

    const event = await prisma.parentsEveningEvent.findUnique({ where: { id } });
    if (!event || event.tenantId !== session.user.tenantId) throw new AuthError("Not found", 404);

    const body = updateSchema.parse(await req.json());
    return prisma.parentsEveningEvent.update({ where: { id }, data: body });
  });
}
