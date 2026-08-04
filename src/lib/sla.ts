import type { TicketPriority } from "@prisma/client";

/**
 * Resolution SLA targets, in hours, by priority. Deliberately a flat config
 * rather than per-tenant configurable — that's a reasonable next step, but
 * every school starting from the same sane defaults keeps this simple for
 * now. CRITICAL assumes "teaching is stopped right now" urgency; the rest
 * are rough school-day-based targets.
 */
export const SLA_RESOLUTION_HOURS: Record<TicketPriority, number> = {
  CRITICAL: 4,
  HIGH: 8, // ~1 school day
  MEDIUM: 24, // ~3 school days
  LOW: 40, // ~5 school days
};

export function computeDueAt(priority: TicketPriority, from: Date = new Date()): Date {
  return new Date(from.getTime() + SLA_RESOLUTION_HOURS[priority] * 60 * 60 * 1000);
}

export function isOverdue(dueAt: Date | string | null, status: string): boolean {
  if (!dueAt) return false;
  if (status === "RESOLVED" || status === "CLOSED") return false;
  return new Date(dueAt).getTime() < Date.now();
}
