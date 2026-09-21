import clsx from "clsx";
import type { ComplianceStatus, TicketPriority, TicketStatus } from "@prisma/client";

const statusStyles: Record<TicketStatus, string> = {
  OPEN: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  IN_PROGRESS: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  ON_HOLD: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  RESOLVED: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  CLOSED: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

export function StatusBadge({ status }: { status: TicketStatus }) {
  return (
    <span className={clsx("rounded-full px-2.5 py-0.5 text-xs font-medium", statusStyles[status])}>
      {status.replace("_", " ")}
    </span>
  );
}

const priorityStyles: Record<TicketPriority, string> = {
  LOW: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  MEDIUM: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  HIGH: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  CRITICAL: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  return (
    <span className={clsx("rounded-full px-2.5 py-0.5 text-xs font-medium", priorityStyles[priority])}>
      {priority}
    </span>
  );
}

const complianceStyles: Record<ComplianceStatus, string> = {
  NOT_STARTED: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  IN_PROGRESS: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  COMPLIANT: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  NON_COMPLIANT: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  NOT_APPLICABLE: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

export function ComplianceBadge({ status }: { status: ComplianceStatus }) {
  return (
    <span className={clsx("rounded-full px-2.5 py-0.5 text-xs font-medium", complianceStyles[status])}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
