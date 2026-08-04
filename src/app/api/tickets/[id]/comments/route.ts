import { z } from "zod";
import { requireTenantSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { canManageTickets } from "@/lib/roles";
import { notifyNewComment } from "@/lib/notifications/events";

type Params = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  body: z.string().min(1).max(5000),
  isInternal: z.boolean().optional(),
});

export async function POST(req: Request, { params }: Params) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    const { id } = await params;
    const staff = canManageTickets(session.user.role);

    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket || ticket.tenantId !== session.user.tenantId) throw new AuthError("Ticket not found", 404);
    if (!staff && ticket.requesterId !== session.user.id) throw new AuthError("Ticket not found", 404);

    const { body, isInternal } = bodySchema.parse(await req.json());
    // Requesters can never post internal-only notes.
    const internal = staff ? Boolean(isInternal) : false;

    const comment = await prisma.ticketComment.create({
      data: { ticketId: id, authorId: session.user.id, body, isInternal: internal },
      include: { author: { select: { id: true, name: true, email: true, role: true } } },
    });

    // Reopen a resolved/closed ticket if the requester replies again.
    if (!staff && (ticket.status === "RESOLVED" || ticket.status === "CLOSED")) {
      await prisma.ticket.update({ where: { id }, data: { status: "OPEN", resolvedAt: null, closedAt: null } });
    }

    // Internal notes are staff-only chatter — don't email the requester about them.
    if (!internal) {
      await notifyNewComment(ticket, session.user.id, staff);
    }

    return comment;
  });
}
