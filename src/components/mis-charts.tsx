"use client";

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const BEHAVIOUR_COLORS: Record<string, string> = {
  ACHIEVEMENT: "#22c55e",
  CONCERN: "#f59e0b",
  BULLYING: "#f97316",
  SAFEGUARDING: "#ef4444",
};

export function AttendanceTrendChart({ trend }: { trend: { week: string; attendancePct: number }[] }) {
  if (trend.length === 0) {
    return <p className="flex h-56 items-center justify-center text-sm text-slate-600">No attendance recorded yet.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={224}>
      <LineChart data={trend}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
        <XAxis dataKey="week" tick={{ fontSize: 12, fill: "#475569" }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} />
        <YAxis
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
          tick={{ fontSize: 12, fill: "#475569" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{ borderRadius: 8, borderColor: "#e2e8f0", fontSize: 13 }}
          formatter={(v) => [`${v}%`, "Attendance"]}
        />
        <Line type="monotone" dataKey="attendancePct" stroke="#4f46e5" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function BehaviourPointsChart({ points }: { points: { category: string; points: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={224}>
      <BarChart data={points}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
        <XAxis dataKey="category" tick={{ fontSize: 12, fill: "#475569" }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: "#475569" }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ borderRadius: 8, borderColor: "#e2e8f0", fontSize: 13 }} />
        <Bar dataKey="points" radius={[6, 6, 0, 0]}>
          {points.map((p) => (
            <Cell key={p.category} fill={BEHAVIOUR_COLORS[p.category] ?? "#94a3b8"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function AssessmentDistributionChart({ data }: { data: { attainment: string; count: number }[] }) {
  if (data.length === 0) {
    return <p className="flex h-56 items-center justify-center text-sm text-slate-600">No assessment results yet.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={224}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
        <XAxis dataKey="attainment" tick={{ fontSize: 12, fill: "#475569" }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#475569" }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ borderRadius: 8, borderColor: "#e2e8f0", fontSize: 13 }} />
        <Bar dataKey="count" fill="#4f46e5" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
