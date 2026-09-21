import type { PrismaClient, TicketStatus } from "@prisma/client";
import { notifySlaBreach } from "./notifications/events";

/** Auto-close a ticket that's sat RESOLVED with no reply for this long — the requester can still reply to reopen it. */
const AUTO_CLOSE_RESOLVED_AFTER_DAYS = 5;

const OPEN_STATUSES: TicketStatus[] = ["OPEN", "IN_PROGRESS", "ON_HOLD"];

/**
 * Finds tickets that have passed their SLA due date and haven't been
 * alerted on yet, emails the assignee (or the whole team if unassigned),
 * and marks them alerted so the next run doesn't re-send. Meant to be
 * called on a schedule (see /api/cron/run) — nothing here assumes it's
 * only ever called once.
 */
export async function runSlaBreachAlerts(prisma: PrismaClient): Promise<number> {
  const breached = await prisma.ticket.findMany({
    where: {
      isDeleted: false,
      status: { in: OPEN_STATUSES },
      dueAt: { lt: new Date() },
      slaBreachAlertedAt: null,
    },
    select: { id: true, number: true, subject: true, tenantId: true, requesterId: true, assigneeId: true },
  });

  for (const ticket of breached) {
    await notifySlaBreach(ticket);
    await prisma.ticket.update({ where: { id: ticket.id }, data: { slaBreachAlertedAt: new Date() } });
  }

  return breached.length;
}

/**
 * Auto-closes tickets that have been RESOLVED for a while with no further
 * reply — tidies up the ticket list without anyone having to do it by hand.
 * A requester replying still reopens a closed ticket, so this isn't a
 * one-way door.
 */
export async function runAutoCloseInactiveResolved(prisma: PrismaClient): Promise<number> {
  const cutoff = new Date(Date.now() - AUTO_CLOSE_RESOLVED_AFTER_DAYS * 24 * 60 * 60 * 1000);
  const result = await prisma.ticket.updateMany({
    where: { isDeleted: false, status: "RESOLVED", resolvedAt: { lt: cutoff } },
    data: { status: "CLOSED", closedAt: new Date() },
  });
  return result.count;
}
