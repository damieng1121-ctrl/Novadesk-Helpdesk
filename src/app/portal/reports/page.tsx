"use client";

import { useEffect, useState } from "react";

type Ranked = { label: string; count: number };
type AgentRow = { name: string; open: number; resolved: number; avgResolutionHours: number | null };

type Summary = {
  totalTickets: number;
  byStatus: { status: string; count: number }[];
  byPriority: { priority: string; count: number }[];
  byCategory: Ranked[];
  byCompany: Ranked[];
  byBrand: Ranked[];
  agentLeaderboard: AgentRow[];
  openOverdue: number;
  avgResolutionHours: number | null;
  resolvedSampleSize: number;
};

const STATUS_ORDER = ["OPEN", "IN_PROGRESS", "ON_HOLD", "RESOLVED", "CLOSED"];
const PRIORITY_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const RANGE_OPTIONS = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
  { label: "Last 12 months", days: 365 },
  { label: "All time", days: 0 },
];

export default function ReportsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [days, setDays] = useState(0);
  const [tab, setTab] = useState<"overview" | "agents">("overview");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/reports/summary?days=${days}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setSummary(data);
      });
    return () => {
      cancelled = true;
    };
  }, [days]);

  if (!summary) return <p className="text-sm text-slate-700">Loading…</p>;

  const maxStatusCount = Math.max(1, ...summary.byStatus.map((s) => s.count));
  const maxPriorityCount = Math.max(1, ...summary.byPriority.map((p) => p.count));
  const maxCategoryCount = Math.max(1, ...summary.byCategory.map((c) => c.count));
  const maxCompanyCount = Math.max(1, ...summary.byCompany.map((c) => c.count));
  const maxBrandCount = Math.max(1, ...summary.byBrand.map((c) => c.count));
  // Only worth its own section once a second Brand actually exists — a
  // single-brand helpdesk (the common case) would otherwise just show one
  // "Uncategorised" bar, which tells you nothing.
  const showBrandBreakdown = summary.byBrand.length > 1 || summary.byBrand.some((b) => b.label !== "Uncategorised");

  const totalResolved = summary.agentLeaderboard.reduce((sum, a) => sum + a.resolved, 0);
  const topPerformer = summary.agentLeaderboard[0]; // already sorted by resolved count, most first
  const resolutionHoursAcrossAgents = summary.agentLeaderboard
    .map((a) => a.avgResolutionHours)
    .filter((h): h is number => h !== null);
  const teamAvgResolutionHours = resolutionHoursAcrossAgents.length
    ? resolutionHoursAcrossAgents.reduce((sum, h) => sum + h, 0) / resolutionHoursAcrossAgents.length
    : null;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Reports</h1>
          <div className="mt-3 flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
            <button
              onClick={() => setTab("overview")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === "overview" ? "bg-indigo-50 text-indigo-700" : "text-slate-700 hover:text-slate-900"}`}
            >
              Helpdesk Performance
            </button>
            <button
              onClick={() => setTab("agents")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === "agents" ? "bg-indigo-50 text-indigo-700" : "text-slate-700 hover:text-slate-900"}`}
            >
              Agent Performance
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            {RANGE_OPTIONS.map((o) => (
              <option key={o.days} value={o.days}>
                {o.label}
              </option>
            ))}
          </select>
          <a
            href={`/api/reports/export?days=${days}`}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Export CSV
          </a>
        </div>
      </div>

      {tab === "overview" && (
        <>
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
            <RankedList title="By status" rows={summary.byStatus.map((s) => ({ label: s.status.replace("_", " "), count: s.count }))} order={STATUS_ORDER.map((s) => s.replace("_", " "))} max={maxStatusCount} colorClass="bg-indigo-500" />
            <RankedList title="By priority" rows={summary.byPriority.map((p) => ({ label: p.priority, count: p.count }))} order={PRIORITY_ORDER} max={maxPriorityCount} colorClass="bg-orange-500" />
            <RankedList title="By category" rows={summary.byCategory} max={maxCategoryCount} colorClass="bg-teal-500" />
            <RankedList title="By company" rows={summary.byCompany} max={maxCompanyCount} colorClass="bg-purple-500" />
            {showBrandBreakdown && (
              <RankedList title="By brand" rows={summary.byBrand} max={maxBrandCount} colorClass="bg-rose-500" />
            )}
          </div>
        </>
      )}

      {tab === "agents" && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Technicians with tickets" value={summary.agentLeaderboard.length} />
            <Stat label="Total resolved" value={totalResolved} />
            <Stat label="Top performer" value={topPerformer ? topPerformer.name : "—"} />
            <Stat
              label="Team avg. resolution time"
              value={teamAvgResolutionHours !== null ? `${teamAvgResolutionHours.toFixed(1)}h` : "—"}
            />
          </div>

          <div className="mt-8 rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-900">Agent leaderboard</h2>
            {summary.agentLeaderboard.length === 0 ? (
              <p className="mt-4 text-sm text-slate-600">No tickets have been assigned yet.</p>
            ) : (
              <table className="mt-4 w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-600">
                    <th className="py-2 font-medium">Technician</th>
                    <th className="py-2 font-medium">Currently open</th>
                    <th className="py-2 font-medium">Resolved</th>
                    <th className="py-2 font-medium">Avg. resolution time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summary.agentLeaderboard.map((a) => (
                    <tr key={a.name}>
                      <td className="py-2.5 font-medium text-slate-900">{a.name}</td>
                      <td className="py-2.5 text-slate-700">{a.open}</td>
                      <td className="py-2.5 text-slate-700">{a.resolved}</td>
                      <td className="py-2.5 text-slate-700">
                        {a.avgResolutionHours !== null ? `${a.avgResolutionHours.toFixed(1)}h` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function RankedList({
  title,
  rows,
  order,
  max,
  colorClass,
}: {
  title: string;
  rows: { label: string; count: number }[];
  order?: string[];
  max: number;
  colorClass: string;
}) {
  const ordered = order ? order.map((label) => rows.find((r) => r.label === label) ?? { label, count: 0 }) : rows;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold text-slate-900">{title}</h2>
      <div className="mt-4 space-y-2">
        {ordered.length === 0 && <p className="text-sm text-slate-600">No data yet.</p>}
        {ordered.map((row) => (
          <div key={row.label} className="flex items-center gap-3 text-sm">
            <span className="w-28 shrink-0 truncate text-slate-600" title={row.label}>
              {row.label}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${(row.count / max) * 100}%` }} />
            </div>
            <span className="w-8 shrink-0 text-right text-slate-700">{row.count}</span>
          </div>
        ))}
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
