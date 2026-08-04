import { z } from "zod";
import { requireTenantSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { canManageTickets } from "@/lib/roles";

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
    },
  });
  if (!ticket || ticket.tenantId !== tenantId) return null;
  if (!staff && ticket.requesterId !== userId) return null;
  if (!staff) {
    ticket.comments = ticket.comments.filter((c) => !c.isInternal);
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
  categoryId: z.string().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
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

    return ticket;
  });
}
