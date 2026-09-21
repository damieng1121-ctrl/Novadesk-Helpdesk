import { prisma } from "@/lib/db";
import { getNotificationProvider } from "./index";
import { createNotification, createNotifications } from "./inapp";

function ticketUrl(ticketId: string): string {
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  return `${base}/portal/tickets/${ticketId}`;
}

/** In-app notifications link by relative path, not the absolute mail URL above. */
function ticketPath(ticketId: string): string {
  return `/portal/tickets/${ticketId}`;
}

async function tenantStaff(tenantId: string): Promise<{ id: string; email: string }[]> {
  return prisma.user.findMany({
    where: { tenantId, role: { in: ["AGENT", "TENANT_ADMIN"] }, isActive: true },
    select: { id: true, email: true },
  });
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
    await createNotification({
      tenantId: ticket.tenantId,
      userId: requester.id,
      type: "ticket.created",
      title: `Ticket logged: #${ticket.number} ${ticket.subject}`,
      link: ticketPath(ticket.id),
    });
  }

  const staff = await tenantStaff(ticket.tenantId);
  await Promise.all(
    staff.map((s) =>
      notifications.send({
        to: s.email,
        subject: `New ticket: #${ticket.number} ${ticket.subject}`,
        text: `A new ticket needs triage.\n\n${ticketUrl(ticket.id)}`,
      }),
    ),
  );
  await createNotifications(
    staff.map((s) => ({
      tenantId: ticket.tenantId,
      userId: s.id,
      type: "ticket.created" as const,
      title: `New ticket: #${ticket.number} ${ticket.subject}`,
      link: ticketPath(ticket.id),
    })),
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
      await createNotification({
        tenantId: ticket.tenantId,
        userId: requester.id,
        type: "ticket.comment",
        title: `New reply on #${ticket.number}: ${ticket.subject}`,
        link: ticketPath(ticket.id),
      });
    }
    return;
  }

  // Requester replied — notify the assignee, or the whole team if unassigned.
  const recipients = ticket.assigneeId
    ? [await prisma.user.findUnique({ where: { id: ticket.assigneeId }, select: { id: true, email: true } })].filter(
        (u): u is { id: string; email: string } => !!u,
      )
    : await tenantStaff(ticket.tenantId);

  await Promise.all(
    recipients.map((r) =>
      notifications.send({
        to: r.email,
        subject: `New reply on ticket #${ticket.number}: ${ticket.subject}`,
        text: `The requester replied.\n\n${ticketUrl(ticket.id)}`,
      }),
    ),
  );
  await createNotifications(
    recipients.map((r) => ({
      tenantId: ticket.tenantId,
      userId: r.id,
      type: "ticket.comment" as const,
      title: `New reply on #${ticket.number}: ${ticket.subject}`,
      link: ticketPath(ticket.id),
    })),
  );
}

export async function notifySlaBreach(ticket: TicketForNotification): Promise<void> {
  const notifications = getNotificationProvider();
  // The assignee if there is one, otherwise the whole team — same fallback
  // as a requester's reply on an unassigned ticket.
  const recipients = ticket.assigneeId
    ? [await prisma.user.findUnique({ where: { id: ticket.assigneeId }, select: { id: true, email: true } })].filter(
        (u): u is { id: string; email: string } => !!u,
      )
    : await tenantStaff(ticket.tenantId);

  await Promise.all(
    recipients.map((r) =>
      notifications.send({
        to: r.email,
        subject: `SLA breached: ticket #${ticket.number} ${ticket.subject}`,
        text: `This ticket has passed its SLA due date and is still open.\n\n${ticketUrl(ticket.id)}`,
      }),
    ),
  );
  await createNotifications(
    recipients.map((r) => ({
      tenantId: ticket.tenantId,
      userId: r.id,
      type: "sla.breach" as const,
      title: `SLA breached: #${ticket.number} ${ticket.subject}`,
      link: ticketPath(ticket.id),
    })),
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
  await createNotification({
    tenantId: ticket.tenantId,
    userId: requester.id,
    type: "ticket.resolved",
    title: `Resolved: #${ticket.number} ${ticket.subject}`,
    body: "Let us know how we did — rate this ticket on the ticket page.",
    link: ticketPath(ticket.id),
  });
}

export async function notifyTicketAssigned(ticket: TicketForNotification, assigneeId: string): Promise<void> {
  const notifications = getNotificationProvider();
  const assignee = await prisma.user.findUnique({ where: { id: assigneeId } });
  if (!assignee) return;
  await notifications.send({
    to: assignee.email,
    subject: `Assigned to you: ticket #${ticket.number} ${ticket.subject}`,
    text: `This ticket has been assigned to you.\n\n${ticketUrl(ticket.id)}`,
  });
  await createNotification({
    tenantId: ticket.tenantId,
    userId: assignee.id,
    type: "ticket.assigned",
    title: `Assigned to you: #${ticket.number} ${ticket.subject}`,
    link: ticketPath(ticket.id),
  });
}
