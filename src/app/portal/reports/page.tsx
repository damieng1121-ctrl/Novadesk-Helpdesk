"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AttendanceTrendChart, BehaviourPointsChart, AssessmentDistributionChart } from "@/components/mis-charts";

type Summary = {
  totalTickets: number;
  byStatus: { status: string; count: number }[];
  byPriority: { priority: string; count: number }[];
  openOverdue: number;
  avgResolutionHours: number | null;
  resolvedSampleSize: number;
};

type MisSummary = {
  attendanceTrend: { week: string; attendancePct: number }[];
  persistentAbsence: { id: string; name: string; totalSessions: number; attendancePct: number | null }[];
  behaviourPoints: { category: string; points: number }[];
  assessmentDistribution: { attainment: string; count: number }[];
  subjects: { id: string; name: string }[];
};

const STATUS_ORDER = ["OPEN", "IN_PROGRESS", "ON_HOLD", "RESOLVED", "CLOSED"];
const PRIORITY_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

export default function ReportsPage() {
  const [tab, setTab] = useState<"helpdesk" | "mis">("helpdesk");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [misSummary, setMisSummary] = useState<MisSummary | null>(null);
  const [subjectId, setSubjectId] = useState("");

  useEffect(() => {
    fetch("/api/reports/summary")
      .then((r) => r.json())
      .then(setSummary);
  }, []);

  useEffect(() => {
    if (tab !== "mis") return;
    const query = subjectId ? `?subjectId=${subjectId}` : "";
    fetch(`/api/reports/mis-summary${query}`)
      .then((r) => r.json())
      .then(setMisSummary);
  }, [tab, subjectId]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Reports</h1>

      <div className="mt-4 flex gap-2 border-b border-slate-200">
        <TabButton active={tab === "helpdesk"} onClick={() => setTab("helpdesk")}>
          Helpdesk
        </TabButton>
        <TabButton active={tab === "mis"} onClick={() => setTab("mis")}>
          School MIS
        </TabButton>
      </div>

      {tab === "helpdesk" && (summary ? <HelpdeskReports summary={summary} /> : <Loading />)}
      {tab === "mis" &&
        (misSummary ? (
          <MisReports summary={misSummary} subjectId={subjectId} onSubjectChange={setSubjectId} />
        ) : (
          <Loading />
        ))}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
        active ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-600 hover:text-slate-900"
      }`}
    >
      {children}
    </button>
  );
}

function Loading() {
  return <p className="mt-6 text-sm text-slate-700">Loading…</p>;
}

function HelpdeskReports({ summary }: { summary: Summary }) {
  const maxStatusCount = Math.max(1, ...summary.byStatus.map((s) => s.count));
  const maxPriorityCount = Math.max(1, ...summary.byPriority.map((p) => p.count));

  return (
    <div>
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
                      className="h-full rounded-full bg-indigo-500"
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

function MisReports({
  summary,
  subjectId,
  onSubjectChange,
}: {
  summary: MisSummary;
  subjectId: string;
  onSubjectChange: (id: string) => void;
}) {
  return (
    <div>
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">Attendance trend (last 8 weeks)</h2>
          <AttendanceTrendChart trend={summary.attendanceTrend} />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">Behaviour points by category</h2>
          <BehaviourPointsChart points={summary.behaviourPoints} />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Assessment distribution</h2>
            {summary.subjects.length > 0 && (
              <select
                value={subjectId}
                onChange={(e) => onSubjectChange(e.target.value)}
                className="rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-700"
              >
                <option value="">All subjects</option>
                {summary.subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <AssessmentDistributionChart data={summary.assessmentDistribution} />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">Persistent absence (below 90%)</h2>
          {summary.persistentAbsence.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">No pupils currently below the persistent-absence threshold.</p>
          ) : (
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="text-left text-slate-600">
                  <th className="pb-2 font-medium">Pupil</th>
                  <th className="pb-2 font-medium">Attendance</th>
                </tr>
              </thead>
              <tbody>
                {summary.persistentAbsence.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100">
                    <td className="py-2">
                      <Link href={`/portal/pupils/${p.id}`} className="text-indigo-700 hover:underline">
                        {p.name}
                      </Link>
                    </td>
                    <td className="py-2 text-red-600">{p.attendancePct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
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
