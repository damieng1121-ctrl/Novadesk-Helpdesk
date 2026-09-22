import { prisma } from "@/lib/db";
import { getAiProviderForTenant } from "@/lib/ai";
import { computeDueAt } from "@/lib/sla";
import { notifyTicketCreated } from "@/lib/notifications/events";
import { isOutsideBusinessHours, dateKey } from "@/lib/out-of-hours";
import type { TicketPriority, TicketType } from "@prisma/client";

/**
 * Shared by the portal's "raise a ticket" API and the inbound-email webhook
 * — both just need "make a ticket for this requester" with the same AI
 * triage, SLA due date, out-of-hours flag, and notifications.
 */
export async function createTicket(input: {
  tenantId: string;
  requesterId: string;
  /** Who actually performed the action, for the audit log — defaults to requesterId (the normal self-service case). Differs when staff raise a ticket on someone else's behalf. */
  actorId?: string;
  subject: string;
  description: string;
  categoryId?: string;
  brandId?: string;
  /** Explicit override — if omitted, defaults to the requester's own Company. */
  companyId?: string;
  priority?: TicketPriority;
  type?: TicketType;
}) {
  const { tenantId, requesterId } = input;
  const actorId = input.actorId ?? requesterId;

  const [categories, brands, companies, requesterRow, tenant, holidays] = await Promise.all([
    prisma.category.findMany({ where: { tenantId } }),
    prisma.brand.findMany({ where: { tenantId }, select: { id: true } }),
    prisma.company.findMany({ where: { tenantId }, select: { id: true } }),
    prisma.user.findUnique({ where: { id: requesterId }, select: { companyId: true } }),
    prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { outOfHoursEnabled: true, outOfHoursStart: true, outOfHoursEnd: true, outOfHoursWeekendOnly: true },
    }),
    prisma.holiday.findMany({ where: { tenantId }, select: { date: true } }),
  ]);
  // Auto-select the requester's own Company unless the caller explicitly
  // picked a different (and valid, for this tenant) one — e.g. staff
  // correcting a wrong auto-match, or raising a ticket for someone whose
  // own profile has no Company set yet.
  const companyId = companies.some((c) => c.id === input.companyId) ? input.companyId : requesterRow?.companyId ?? undefined;
  const holidayDates = new Set(holidays.map((h) => dateKey(h.date)));
  const outOfHours = isOutsideBusinessHours(tenant, new Date(), holidayDates);
  // Only trust a caller-supplied brandId if it's actually one of this
  // tenant's Brands; a single-brand helpdesk (the common case) gets that
  // one Brand automatically without anyone having to pick anything.
  const brandId = brands.some((b) => b.id === input.brandId)
    ? input.brandId
    : brands.length === 1
      ? brands[0].id
      : undefined;

  const ai = await getAiProviderForTenant(tenantId);
  const triage = await ai.triageTicket({
    subject: input.subject,
    description: input.description,
    categoryNames: categories.map((c) => c.name),
  });
  const aiCategory = categories.find((c) => c.name === triage.suggestedCategory);

  let ticket = null;
  for (let attempt = 0; attempt < 3 && !ticket; attempt++) {
    const agg = await prisma.ticket.aggregate({ where: { tenantId }, _max: { number: true } });
    const number = (agg._max.number ?? 0) + 1;
    const priority = input.priority ?? triage.suggestedPriority ?? "MEDIUM";
    try {
      ticket = await prisma.ticket.create({
        data: {
          tenantId,
          number,
          subject: input.subject,
          description: input.description,
          categoryId: input.categoryId ?? aiCategory?.id,
          brandId,
          companyId,
          type: input.type ?? "INCIDENT",
          priority,
          dueAt: computeDueAt(priority),
          isOutOfHours: outOfHours,
          requesterId,
          aiSuggestedCategory: triage.suggestedCategory,
          aiSuggestedPriority: triage.suggestedPriority,
          aiSummary: triage.summary || null,
          sentimentScore: triage.sentimentScore,
          aiSuggestedSolution: triage.suggestedSolution,
        },
        include: { category: true, requester: true, company: true },
      });
    } catch (err) {
      const isUniqueClash = typeof err === "object" && err !== null && "code" in err && err.code === "P2002";
      if (!isUniqueClash || attempt === 2) throw err;
    }
  }

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: actorId,
      action: "ticket.created",
      entityType: "Ticket",
      entityId: ticket!.id,
      metadata: actorId !== requesterId ? { raisedOnBehalfOf: requesterId } : undefined,
    },
  });

  await notifyTicketCreated(ticket!);

  return ticket!;
}
