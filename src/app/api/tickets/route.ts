import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { requireTenantSession } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { canManageTickets } from "@/lib/roles";
import { getAiProviderForTenant } from "@/lib/ai";
import { computeDueAt } from "@/lib/sla";
import { notifyTicketCreated } from "@/lib/notifications/events";

export async function GET(req: Request) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const assignee = searchParams.get("assignee"); // "me" | "unassigned" | null
    const categoryId = searchParams.get("categoryId");
    const search = searchParams.get("q");

    const where: Prisma.TicketWhereInput = { tenantId: session.user.tenantId };

    // Requesters only ever see their own tickets, regardless of query params.
    if (!canManageTickets(session.user.role)) {
      where.requesterId = session.user.id;
    } else {
      if (assignee === "me") where.assigneeId = session.user.id;
      if (assignee === "unassigned") where.assigneeId = null;
    }

    if (status) where.status = status as Prisma.EnumTicketStatusFilter["equals"];
    if (categoryId) where.categoryId = categoryId;
    if (search) {
      where.OR = [
        { subject: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const tickets = await prisma.ticket.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        category: true,
        requester: { select: { id: true, name: true, email: true } },
        assignee: { select: { id: true, name: true, email: true } },
      },
    });
    return tickets;
  });
}

const createSchema = z.object({
  subject: z.string().min(3).max(150),
  description: z.string().min(1).max(5000),
  categoryId: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
});

export async function POST(req: Request) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    const body = createSchema.parse(await req.json());
    const tenantId = session.user.tenantId;

    const categories = await prisma.category.findMany({ where: { tenantId } });

    const ai = await getAiProviderForTenant(tenantId);
    const triage = await ai.triageTicket({
      subject: body.subject,
      description: body.description,
      categoryNames: categories.map((c) => c.name),
    });
    const aiCategory = categories.find((c) => c.name === triage.suggestedCategory);

    let ticket = null;
    for (let attempt = 0; attempt < 3 && !ticket; attempt++) {
      const agg = await prisma.ticket.aggregate({ where: { tenantId }, _max: { number: true } });
      const number = (agg._max.number ?? 0) + 1;
      const priority = body.priority ?? triage.suggestedPriority ?? "MEDIUM";
      try {
        ticket = await prisma.ticket.create({
          data: {
            tenantId,
            number,
            subject: body.subject,
            description: body.description,
            categoryId: body.categoryId ?? aiCategory?.id,
            priority,
            dueAt: computeDueAt(priority),
            requesterId: session.user.id,
            aiSuggestedCategory: triage.suggestedCategory,
            aiSuggestedPriority: triage.suggestedPriority,
            aiSummary: triage.summary || null,
          },
          include: { category: true, requester: true },
        });
      } catch (err) {
        const isUniqueClash = typeof err === "object" && err !== null && "code" in err && err.code === "P2002";
        if (!isUniqueClash || attempt === 2) throw err;
      }
    }

    await prisma.auditLog.create({
      data: {
        tenantId,
        userId: session.user.id,
        action: "ticket.created",
        entityType: "Ticket",
        entityId: ticket!.id,
      },
    });

    await notifyTicketCreated(ticket!);

    return ticket;
  });
}
