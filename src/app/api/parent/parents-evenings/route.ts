import { z } from "zod";
import { requireParentSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";

function isBookingOpen(event: { bookingOpensAt: Date | null; bookingClosesAt: Date | null }): boolean {
  const now = new Date();
  if (event.bookingOpensAt && now < event.bookingOpensAt) return false;
  if (event.bookingClosesAt && now > event.bookingClosesAt) return false;
  return true;
}

export async function GET() {
  return withApiErrors(async () => {
    const session = await requireParentSession();

    const links = await prisma.pupilGuardian.findMany({
      where: { tenantId: session.user.tenantId, guardianId: session.user.id },
      include: { pupil: { select: { id: true, firstName: true, lastName: true, formGroupId: true } } },
    });
    const children = links.map((l) => l.pupil).filter((p) => p.formGroupId);
    const formGroupIds = new Set(children.map((c) => c.formGroupId as string));

    const allEvents = await prisma.parentsEveningEvent.findMany({
      where: { tenantId: session.user.tenantId },
      orderBy: { date: "asc" },
    });

    const relevantEvents = allEvents.filter((ev) => {
      const evFormGroups = Array.isArray(ev.formGroupIds) ? (ev.formGroupIds as string[]) : [];
      return evFormGroups.some((id) => formGroupIds.has(id)) && isBookingOpen(ev);
    });

    const eventIds = relevantEvents.map((ev) => ev.id);
    const slots = eventIds.length
      ? await prisma.appointmentSlot.findMany({
          where: {
            tenantId: session.user.tenantId,
            eventId: { in: eventIds },
            OR: [{ status: "AVAILABLE" }, { status: "BOOKED", guardianId: session.user.id }],
          },
          orderBy: { startTime: "asc" },
          include: {
            teacher: { select: { id: true, name: true, email: true } },
            pupil: { select: { id: true, firstName: true, lastName: true } },
          },
        })
      : [];

    return {
      children: children.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}`, formGroupId: c.formGroupId })),
      events: relevantEvents.map((ev) => ({
        id: ev.id,
        title: ev.title,
        date: ev.date,
        startTime: ev.startTime,
        endTime: ev.endTime,
        locationNote: ev.locationNote,
        formGroupIds: ev.formGroupIds,
        slots: slots.filter((s) => s.eventId === ev.id),
      })),
    };
  });
}

const bookSchema = z.object({
  slotId: z.string().min(1),
  pupilId: z.string().min(1),
});

export async function POST(req: Request) {
  return withApiErrors(async () => {
    const session = await requireParentSession();
    const body = bookSchema.parse(await req.json());

    const link = await prisma.pupilGuardian.findUnique({
      where: { pupilId_guardianId: { pupilId: body.pupilId, guardianId: session.user.id } },
      include: { pupil: { select: { formGroupId: true } } },
    });
    if (!link || link.tenantId !== session.user.tenantId) throw new AuthError("You aren't linked to this pupil", 403);

    const slot = await prisma.appointmentSlot.findUnique({ where: { id: body.slotId }, include: { event: true } });
    if (!slot || slot.tenantId !== session.user.tenantId) throw new AuthError("Slot not found", 404);
    if (slot.status !== "AVAILABLE") throw new AuthError("This slot is no longer available", 409);

    const evFormGroups = Array.isArray(slot.event.formGroupIds) ? (slot.event.formGroupIds as string[]) : [];
    if (!link.pupil.formGroupId || !evFormGroups.includes(link.pupil.formGroupId)) {
      throw new AuthError("This event doesn't apply to this pupil", 403);
    }

    return prisma.appointmentSlot.update({
      where: { id: body.slotId },
      data: { status: "BOOKED", pupilId: body.pupilId, guardianId: session.user.id },
    });
  });
}

const cancelSchema = z.object({ slotId: z.string().min(1) });

export async function DELETE(req: Request) {
  return withApiErrors(async () => {
    const session = await requireParentSession();
    const { searchParams } = new URL(req.url);
    const { slotId } = cancelSchema.parse({ slotId: searchParams.get("slotId") });

    const slot = await prisma.appointmentSlot.findUnique({ where: { id: slotId } });
    if (!slot || slot.tenantId !== session.user.tenantId) throw new AuthError("Slot not found", 404);
    if (slot.guardianId !== session.user.id) throw new AuthError("This isn't your booking", 403);

    return prisma.appointmentSlot.update({
      where: { id: slotId },
      data: { status: "AVAILABLE", pupilId: null, guardianId: null },
    });
  });
}
