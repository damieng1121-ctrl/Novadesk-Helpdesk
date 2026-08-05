"use client";

import { useEffect, useState } from "react";

type Summary = {
  totalTickets: number;
  byStatus: { status: string; count: number }[];
  byPriority: { priority: string; count: number }[];
  openOverdue: number;
  avgResolutionHours: number | null;
  resolvedSampleSize: number;
};

const STATUS_ORDER = ["OPEN", "IN_PROGRESS", "ON_HOLD", "RESOLVED", "CLOSED"];
const PRIORITY_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

export default function ReportsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    fetch("/api/reports/summary")
      .then((r) => r.json())
      .then(setSummary);
  }, []);

  if (!summary) return <p className="text-sm text-slate-700">Loading…</p>;

  const maxStatusCount = Math.max(1, ...summary.byStatus.map((s) => s.count));
  const maxPriorityCount = Math.max(1, ...summary.byPriority.map((p) => p.count));

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Reports</h1>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Total tickets" value={summary.totalTickets} />
        <Stat label="Overdue (open)" value={summary.openOverdue} highlight={summary.openOverdue > 0} />
        <Stat
          label="Avg. resolution time"
          value={summary.avgResolutionHours ? `${summary.avgResolutionHours.toFixed(1)}h` : "—"}
        />
        <Stat label="Resolved sample" value={summary.resolvedSampleSize} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">By status</h2>
          <div className="mt-4 space-y-2">
            {STATUS_ORDER.map((status) => {
              const count = summary.byStatus.find((s) => s.status === status)?.count ?? 0;
              return (
                <div key={status} className="flex items-center gap-3 text-sm">
                  <span className="w-28 shrink-0 text-slate-600">{status.replace("_", " ")}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-blue-500"
                      style={{ width: `${(count / maxStatusCount) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-slate-700">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">By priority</h2>
          <div className="mt-4 space-y-2">
            {PRIORITY_ORDER.map((priority) => {
              const count = summary.byPriority.find((p) => p.priority === priority)?.count ?? 0;
              return (
                <div key={priority} className="flex items-center gap-3 text-sm">
                  <span className="w-28 shrink-0 text-slate-600">{priority}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-orange-500"
                      style={{ width: `${(count / maxPriorityCount) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-slate-700">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-700">{label}</p>
      <p className={`mt-1 text-3xl font-semibold ${highlight ? "text-red-600" : "text-slate-900"}`}>{value}</p>
    </div>
  );
}
