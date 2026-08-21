import { z } from "zod";
import { requireMisSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function atTime(date: Date, minutesFromMidnight: number): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCMinutes(minutesFromMidnight);
  return d;
}

const bodySchema = z.object({
  teacherId: z.string().min(1),
  startTime: z.string().regex(TIME_RE, "Use HH:MM"),
  endTime: z.string().regex(TIME_RE, "Use HH:MM"),
});

/** Generates AVAILABLE AppointmentSlot rows of event.slotMinutes length across a chosen sub-range of the event's window, for one teacher. */
export async function POST(req: Request, { params }: Params) {
  return withApiErrors(async () => {
    const session = await requireMisSession();
    const { id } = await params;

    const event = await prisma.parentsEveningEvent.findUnique({ where: { id } });
    if (!event || event.tenantId !== session.user.tenantId) throw new AuthError("Not found", 404);

    const body = bodySchema.parse(await req.json());

    const teacher = await prisma.user.findUnique({ where: { id: body.teacherId } });
    if (!teacher || teacher.tenantId !== session.user.tenantId) throw new AuthError("Teacher not found", 404);

    const rangeStart = timeToMinutes(body.startTime);
    const rangeEnd = timeToMinutes(body.endTime);
    const eventStart = timeToMinutes(event.startTime);
    const eventEnd = timeToMinutes(event.endTime);

    if (rangeStart >= rangeEnd) throw new AuthError("Start time must be before end time", 400);
    if (rangeStart < eventStart || rangeEnd > eventEnd) {
      throw new AuthError(`Range must fall within the event's window (${event.startTime}–${event.endTime})`, 400);
    }

    const slotsData = [];
    for (let start = rangeStart; start + event.slotMinutes <= rangeEnd; start += event.slotMinutes) {
      slotsData.push({
        tenantId: session.user.tenantId,
        eventId: id,
        teacherId: body.teacherId,
        startTime: atTime(event.date, start),
        endTime: atTime(event.date, start + event.slotMinutes),
        status: "AVAILABLE" as const,
      });
    }

    if (slotsData.length === 0) throw new AuthError("Range is too short to fit a single slot", 400);

    await prisma.appointmentSlot.createMany({ data: slotsData });
    return { created: slotsData.length };
  });
}
