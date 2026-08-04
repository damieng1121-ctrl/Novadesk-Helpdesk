import clsx from "clsx";
import type { ComplianceStatus, TicketPriority, TicketStatus } from "@prisma/client";

const statusStyles: Record<TicketStatus, string> = {
  OPEN: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-amber-100 text-amber-700",
  ON_HOLD: "bg-slate-200 text-slate-700",
  RESOLVED: "bg-green-100 text-green-700",
  CLOSED: "bg-slate-100 text-slate-500",
};

export function StatusBadge({ status }: { status: TicketStatus }) {
  return (
    <span className={clsx("rounded-full px-2.5 py-0.5 text-xs font-medium", statusStyles[status])}>
      {status.replace("_", " ")}
    </span>
  );
}

const priorityStyles: Record<TicketPriority, string> = {
  LOW: "bg-slate-100 text-slate-600",
  MEDIUM: "bg-blue-50 text-blue-700",
  HIGH: "bg-orange-100 text-orange-700",
  CRITICAL: "bg-red-100 text-red-700",
};

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  return (
    <span className={clsx("rounded-full px-2.5 py-0.5 text-xs font-medium", priorityStyles[priority])}>
      {priority}
    </span>
  );
}

const complianceStyles: Record<ComplianceStatus, string> = {
  NOT_STARTED: "bg-slate-100 text-slate-600",
  IN_PROGRESS: "bg-amber-100 text-amber-700",
  COMPLIANT: "bg-green-100 text-green-700",
  NON_COMPLIANT: "bg-red-100 text-red-700",
  NOT_APPLICABLE: "bg-slate-100 text-slate-400",
};

export function ComplianceBadge({ status }: { status: ComplianceStatus }) {
  return (
    <span className={clsx("rounded-full px-2.5 py-0.5 text-xs font-medium", complianceStyles[status])}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
