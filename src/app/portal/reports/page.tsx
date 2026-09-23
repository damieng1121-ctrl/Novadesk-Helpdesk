"use client";

import { useEffect, useState } from "react";
import { TicketVolumeTrendChart } from "@/components/dashboard-charts";

type Ranked = { label: string; count: number };
type AgentRow = { name: string; open: number; resolved: number; avgResolutionHours: number | null };
type Company = { id: string; name: string };

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
  volumeTrend: { bucketBy: "day" | "week" | "month"; data: { label: string; created: number; resolved: number }[] };
  avgSatisfaction: number | null;
  satisfactionDistribution: { rating: number; count: number }[];
  satisfactionResponses: number;
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
  const [companies, setCompanies] = useState<Company[]>([]);
  const [days, setDays] = useState(0);
  const [companyId, setCompanyId] = useState("");
  const [tab, setTab] = useState<"overview" | "volume" | "agents" | "satisfaction">("overview");

  useEffect(() => {
    fetch("/api/admin/companies")
      .then((r) => (r.ok ? r.json() : []))
      .then(setCompanies);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const qs = new URLSearchParams({ days: String(days) });
    if (companyId) qs.set("companyId", companyId);
    fetch(`/api/reports/summary?${qs.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setSummary(data);
      });
    return () => {
      cancelled = true;
    };
  }, [days, companyId]);

  if (!summary) return <p className="text-sm text-slate-700 dark:text-slate-300">Loading…</p>;

  const exportQs = new URLSearchParams({ days: String(days), ...(companyId ? { companyId } : {}) }).toString();
  const selectedCompanyName = companies.find((c) => c.id === companyId)?.name;

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
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Reports</h1>
          <div className="mt-3 flex gap-1 rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
            <button
              onClick={() => setTab("overview")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === "overview" ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300" : "text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"}`}
            >
              Helpdesk Performance
            </button>
            <button
              onClick={() => setTab("volume")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === "volume" ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300" : "text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"}`}
            >
              Ticket Volume
            </button>
            <button
              onClick={() => setTab("agents")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === "agents" ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300" : "text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"}`}
            >
              Agent Performance
            </button>
            <button
              onClick={() => setTab("satisfaction")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === "satisfaction" ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300" : "text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"}`}
            >
              Satisfaction
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
          >
            <option value="">All schools/companies</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
          >
            {RANGE_OPTIONS.map((o) => (
              <option key={o.days} value={o.days}>
                {o.label}
              </option>
            ))}
          </select>
          <a
            href={`/api/reports/export?${exportQs}`}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Export CSV
          </a>
        </div>
      </div>

      {selectedCompanyName && (
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
          Showing <span className="font-medium text-slate-900 dark:text-slate-100">{selectedCompanyName}</span> only —{" "}
          <button onClick={() => setCompanyId("")} className="text-indigo-600 hover:underline">
            clear
          </button>
        </p>
      )}

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

      {tab === "volume" && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-semibold text-slate-900 dark:text-slate-100">Tickets created vs resolved</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Bucketed by {summary.volumeTrend.bucketBy} for this range.</p>
          <div className="mt-4">
            <TicketVolumeTrendChart data={summary.volumeTrend.data} />
          </div>
        </div>
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

          <div className="mt-8 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">Agent leaderboard</h2>
            {summary.agentLeaderboard.length === 0 ? (
              <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">No tickets have been assigned yet.</p>
            ) : (
              <table className="mt-4 w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-600 dark:border-slate-800 dark:text-slate-400">
                    <th className="py-2 font-medium">Technician</th>
                    <th className="py-2 font-medium">Currently open</th>
                    <th className="py-2 font-medium">Resolved</th>
                    <th className="py-2 font-medium">Avg. resolution time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {summary.agentLeaderboard.map((a) => (
                    <tr key={a.name}>
                      <td className="py-2.5 font-medium text-slate-900 dark:text-slate-100">{a.name}</td>
                      <td className="py-2.5 text-slate-700 dark:text-slate-300">{a.open}</td>
                      <td className="py-2.5 text-slate-700 dark:text-slate-300">{a.resolved}</td>
                      <td className="py-2.5 text-slate-700 dark:text-slate-300">
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

      {tab === "satisfaction" && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat
              label="Average rating"
              value={summary.avgSatisfaction !== null ? `${summary.avgSatisfaction.toFixed(1)} / 5` : "—"}
            />
            <Stat label="Responses" value={summary.satisfactionResponses} />
            <Stat
              label="Response rate"
              value={
                summary.resolvedSampleSize
                  ? `${Math.round((summary.satisfactionResponses / summary.resolvedSampleSize) * 100)}%`
                  : "—"
              }
            />
            <Stat
              label="Happy (4-5 stars)"
              value={
                summary.satisfactionResponses
                  ? `${Math.round(
                      ((summary.satisfactionDistribution.find((d) => d.rating === 4)?.count ?? 0) +
                        (summary.satisfactionDistribution.find((d) => d.rating === 5)?.count ?? 0)) /
                        summary.satisfactionResponses *
                        100,
                    )}%`
                  : "—"
              }
            />
          </div>

          <div className="mt-8 max-w-xl">
            <RankedList
              title="Rating distribution"
              rows={summary.satisfactionDistribution.map((d) => ({ label: `${d.rating} star${d.rating === 1 ? "" : "s"}`, count: d.count }))}
              order={["5 stars", "4 stars", "3 stars", "2 stars", "1 star"]}
              max={Math.max(1, ...summary.satisfactionDistribution.map((d) => d.count))}
              colorClass="bg-amber-400"
            />
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
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
      <div className="mt-4 space-y-2">
        {ordered.length === 0 && <p className="text-sm text-slate-600 dark:text-slate-400">No data yet.</p>}
        {ordered.map((row) => (
          <div key={row.label} className="flex items-center gap-3 text-sm">
            <span className="w-28 shrink-0 truncate text-slate-600 dark:text-slate-400" title={row.label}>
              {row.label}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${(row.count / max) * 100}%` }} />
            </div>
            <span className="w-8 shrink-0 text-right text-slate-700 dark:text-slate-300">{row.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm text-slate-700 dark:text-slate-300">{label}</p>
      <p className={`mt-1 text-3xl font-semibold ${highlight ? "text-red-600 dark:text-red-400" : "text-slate-900 dark:text-slate-100"}`}>{value}</p>
    </div>
  );
}
