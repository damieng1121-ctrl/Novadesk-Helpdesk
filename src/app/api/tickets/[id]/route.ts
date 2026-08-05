import { z } from "zod";
import { requireTenantSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { canManageTickets, isAdmin } from "@/lib/roles";
import { computeDueAt } from "@/lib/sla";
import { notifyTicketResolved } from "@/lib/notifications/events";

type Params = { params: Promise<{ id: string }> };

async function loadTicketForSession(id: string, tenantId: string, userId: string, staff: boolean) {
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      category: true,
      requester: { select: { id: true, name: true, email: true } },
      assignee: { select: { id: true, name: true, email: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true, email: true, role: true } }, attachments: true },
      },
      attachments: true,
      tenant: { select: { outOfHoursMessage: true } },
    },
  });
  if (!ticket || ticket.tenantId !== tenantId || ticket.isDeleted) return null;
  if (!staff && ticket.requesterId !== userId) return null;
  if (!staff) {
    const internalCommentIds = new Set(ticket.comments.filter((c) => c.isInternal).map((c) => c.id));
    ticket.comments = ticket.comments.filter((c) => !c.isInternal);
    // Attachments on an internal note are just as internal as the note itself.
    ticket.attachments = ticket.attachments.filter((a) => !a.commentId || !internalCommentIds.has(a.commentId));
  }
  return ticket;
}

export async function GET(_req: Request, { params }: Params) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    const { id } = await params;
    const staff = canManageTickets(session.user.role);
    const ticket = await loadTicketForSession(id, session.user.tenantId, session.user.id, staff);
    if (!ticket) throw new AuthError("Ticket not found", 404);
    return ticket;
  });
}

const updateSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "ON_HOLD", "RESOLVED", "CLOSED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  type: z.enum(["PROBLEM", "INCIDENT", "REQUEST", "INFORMATION", "TRAINING", "QUOTE"]).optional(),
  categoryId: z.string().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  isDeleted: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: Params) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!canManageTickets(session.user.role)) {
      throw new AuthError("Only helpdesk staff can update tickets", 403);
    }
    const { id } = await params;
    const existing = await prisma.ticket.findUnique({ where: { id } });
    if (!existing || existing.tenantId !== session.user.tenantId) {
      throw new AuthError("Ticket not found", 404);
    }

    const body = updateSchema.parse(await req.json());
    const now = new Date();

    const ticket = await prisma.ticket.update({
      where: { id },
      data: {
        ...body,
        // Re-baseline the SLA due date off the ticket's original creation
        // time whenever priority changes, so escalating/de-escalating a
        // ticket doesn't just reset the clock to "now".
        dueAt: body.priority ? computeDueAt(body.priority, existing.createdAt) : undefined,
        resolvedAt: body.status === "RESOLVED" ? now : body.status ? null : undefined,
        closedAt: body.status === "CLOSED" ? now : body.status ? null : undefined,
      },
      include: { category: true, requester: true, assignee: true },
    });

    await prisma.auditLog.create({
      data: {
        tenantId: session.user.tenantId,
        userId: session.user.id,
        action: "ticket.updated",
        entityType: "Ticket",
        entityId: ticket.id,
        metadata: body,
      },
    });

    if (body.status === "RESOLVED" && existing.status !== "RESOLVED") {
      await notifyTicketResolved(ticket);
    }

    return ticket;
  });
}

/** Permanent, unrecoverable delete — only ever reachable from the trash bin on an already soft-deleted ticket. */
export async function DELETE(_req: Request, { params }: Params) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!isAdmin(session.user.role)) throw new AuthError("Only admins can permanently delete tickets", 403);
    const { id } = await params;

    const existing = await prisma.ticket.findUnique({ where: { id } });
    if (!existing || existing.tenantId !== session.user.tenantId) throw new AuthError("Ticket not found", 404);
    if (!existing.isDeleted) throw new AuthError("Move to trash before permanently deleting", 400);

    await prisma.ticket.delete({ where: { id } });
    await prisma.auditLog.create({
      data: {
        tenantId: session.user.tenantId,
        userId: session.user.id,
        action: "ticket.permanently_deleted",
        entityType: "Ticket",
        entityId: id,
      },
    });
    return { ok: true };
  });
}
