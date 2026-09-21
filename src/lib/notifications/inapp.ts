import { prisma } from "@/lib/db";

export type NotificationType =
  | "ticket.created"
  | "ticket.comment"
  | "ticket.assigned"
  | "ticket.resolved"
  | "sla.breach";

interface CreateNotificationInput {
  tenantId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
}

/** Never throws — a failed in-app notification write shouldn't break the ticket flow that triggered it. */
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  try {
    await prisma.notification.create({ data: input });
  } catch (err) {
    console.error("[notifications:inapp] create failed", err);
  }
}

export async function createNotifications(inputs: CreateNotificationInput[]): Promise<void> {
  if (inputs.length === 0) return;
  try {
    await prisma.notification.createMany({ data: inputs });
  } catch (err) {
    console.error("[notifications:inapp] createMany failed", err);
  }
}
