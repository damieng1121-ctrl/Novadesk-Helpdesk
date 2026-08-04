import { prisma } from "@/lib/db";
import { getNotificationProvider } from "./index";

function ticketUrl(ticketId: string): string {
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  return `${base}/portal/tickets/${ticketId}`;
}

async function tenantStaffEmails(tenantId: string): Promise<string[]> {
  const staff = await prisma.user.findMany({
    where: { tenantId, role: { in: ["AGENT", "TENANT_ADMIN"] }, isActive: true },
    select: { email: true },
  });
  return staff.map((s) => s.email);
}

interface TicketForNotification {
  id: string;
  number: number;
  subject: string;
  tenantId: string;
  requesterId: string;
  assigneeId: string | null;
}

export async function notifyTicketCreated(ticket: TicketForNotification): Promise<void> {
  const notifications = getNotificationProvider();
  const requester = await prisma.user.findUnique({ where: { id: ticket.requesterId } });
  if (requester) {
    await notifications.send({
      to: requester.email,
      subject: `We've got your ticket: #${ticket.number} ${ticket.subject}`,
      text: `Thanks — your ticket has been logged.\n\nYou can follow its progress here: ${ticketUrl(ticket.id)}`,
    });
  }

  const staffEmails = await tenantStaffEmails(ticket.tenantId);
  await Promise.all(
    staffEmails.map((email) =>
      notifications.send({
        to: email,
        subject: `New ticket: #${ticket.number} ${ticket.subject}`,
        text: `A new ticket needs triage.\n\n${ticketUrl(ticket.id)}`,
      }),
    ),
  );
}

export async function notifyNewComment(
  ticket: TicketForNotification,
  authorId: string,
  authorIsStaff: boolean,
): Promise<void> {
  const notifications = getNotificationProvider();

  if (authorIsStaff) {
    // Staff replied — let the requester know, unless they replied to themselves somehow.
    if (authorId === ticket.requesterId) return;
    const requester = await prisma.user.findUnique({ where: { id: ticket.requesterId } });
    if (requester) {
      await notifications.send({
        to: requester.email,
        subject: `New reply on ticket #${ticket.number}: ${ticket.subject}`,
        text: `There's a new reply on your ticket.\n\n${ticketUrl(ticket.id)}`,
      });
    }
    return;
  }

  // Requester replied — notify the assignee, or the whole team if unassigned.
  const recipientEmails = ticket.assigneeId
    ? [(await prisma.user.findUnique({ where: { id: ticket.assigneeId } }))?.email].filter(
        (e): e is string => !!e,
      )
    : await tenantStaffEmails(ticket.tenantId);

  await Promise.all(
    recipientEmails.map((email) =>
      notifications.send({
        to: email,
        subject: `New reply on ticket #${ticket.number}: ${ticket.subject}`,
        text: `The requester replied.\n\n${ticketUrl(ticket.id)}`,
      }),
    ),
  );
}

export async function notifyTicketResolved(ticket: TicketForNotification): Promise<void> {
  const notifications = getNotificationProvider();
  const requester = await prisma.user.findUnique({ where: { id: ticket.requesterId } });
  if (!requester) return;
  await notifications.send({
    to: requester.email,
    subject: `Resolved: ticket #${ticket.number} ${ticket.subject}`,
    text: `Your ticket has been marked resolved. Reply on the ticket if it's not actually fixed and we'll reopen it.\n\n${ticketUrl(ticket.id)}`,
  });
}
