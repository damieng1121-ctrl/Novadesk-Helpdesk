import { z } from "zod";
import { requireTenantSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { canManageTickets } from "@/lib/roles";

type Params = { params: Promise<{ id: string }> };

const bodySchema = z.object({ intoTicketId: z.string() });

/**
 * Merges this ticket (the duplicate report) into another ticket (the one
 * staff keep working). The duplicate is closed and linked via
 * mergedIntoId; its comment history is copied onto the target so agents
 * see everything in one place without losing the original attribution
 * (each copied comment keeps its real author). See Ticket.mergedIntoId's
 * doc comment in schema.prisma for the full behavioural contract.
 */
export async function POST(req: Request, { params }: Params) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!canManageTickets(session.user.role)) throw new AuthError("Only helpdesk staff can merge tickets", 403);
    const { id } = await params;
    const { intoTicketId } = bodySchema.parse(await req.json());
    if (id === intoTicketId) throw new AuthError("A ticket can't be merged into itself", 400);

    const [duplicate, target] = await Promise.all([
      prisma.ticket.findUnique({
        where: { id },
        include: { requester: { select: { name: true, email: true } } },
      }),
      prisma.ticket.findUnique({ where: { id: intoTicketId } }),
    ]);
    if (!duplicate || duplicate.tenantId !== session.user.tenantId) throw new AuthError("Ticket not found", 404);
    if (!target || target.tenantId !== session.user.tenantId) throw new AuthError("Target ticket not found", 404);
    if (duplicate.mergedIntoId) throw new AuthError("This ticket has already been merged into another ticket", 400);
    if (target.mergedIntoId) {
      throw new AuthError("That ticket has itself been merged into another one — merge into its target instead", 400);
    }

    const duplicateComments = await prisma.ticketComment.findMany({
      where: { ticketId: duplicate.id },
      orderBy: { createdAt: "asc" },
    });

    const now = new Date();
    await prisma.$transaction([
      prisma.ticketComment.create({
        data: {
          ticketId: target.id,
          authorId: session.user.id,
          isInternal: true,
          body: `— Merged ticket #${duplicate.number} "${duplicate.subject}" (raised by ${
            duplicate.requester.name ?? duplicate.requester.email
          }) — its history follows:`,
        },
      }),
      ...duplicateComments.map((c) =>
        prisma.ticketComment.create({
          data: {
            ticketId: target.id,
            authorId: c.authorId,
            body: c.body,
            isInternal: c.isInternal,
            createdAt: c.createdAt,
          },
        }),
      ),
      prisma.ticketComment.create({
        data: {
          ticketId: duplicate.id,
          authorId: session.user.id,
          isInternal: true,
          body: `Merged into ticket #${target.number}.`,
        },
      }),
      prisma.ticket.update({
        where: { id: duplicate.id },
        data: { status: "CLOSED", closedAt: now, mergedIntoId: target.id },
      }),
    ]);

    await prisma.auditLog.create({
      data: {
        tenantId: session.user.tenantId,
        userId: session.user.id,
        action: "ticket.merged",
        entityType: "Ticket",
        entityId: duplicate.id,
        metadata: { intoTicketId: target.id, intoTicketNumber: target.number },
      },
    });

    return { ok: true, targetId: target.id, targetNumber: target.number };
  });
}
