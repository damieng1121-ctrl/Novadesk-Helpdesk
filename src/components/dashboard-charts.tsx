"use client";

import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const STATUS_COLORS: Record<string, string> = {
  OPEN: "#3b82f6",
  IN_PROGRESS: "#f59e0b",
  ON_HOLD: "#94a3b8",
  RESOLVED: "#22c55e",
  CLOSED: "#cbd5e1",
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "#94a3b8",
  MEDIUM: "#3b82f6",
  HIGH: "#f97316",
  CRITICAL: "#ef4444",
};

export function TicketsByStatusChart({ byStatus }: { byStatus: { status: string; count: number }[] }) {
  const data = byStatus
    .filter((s) => s.count > 0)
    .map((s) => ({ ...s, label: s.status.replace("_", " ") }));
  if (data.length === 0) {
    return <p className="flex h-56 items-center justify-center text-sm text-slate-600">No tickets yet.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={224}>
      <PieChart>
        <Pie data={data} dataKey="count" nameKey="label" innerRadius={55} outerRadius={85} paddingAngle={2}>
          {data.map((s) => (
            <Cell key={s.status} fill={STATUS_COLORS[s.status] ?? "#94a3b8"} />
          ))}
        </Pie>
        <Tooltip contentStyle={{ borderRadius: 8, borderColor: "#e2e8f0", fontSize: 13 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function VolumeByPriorityChart({ byPriority }: { byPriority: { priority: string; count: number }[] }) {
  const order = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
  const data = order.map((priority) => ({
    priority,
    count: byPriority.find((p) => p.priority === priority)?.count ?? 0,
  }));
  return (
    <ResponsiveContainer width="100%" height={224}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
        <XAxis dataKey="priority" tick={{ fontSize: 12, fill: "#475569" }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#475569" }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ borderRadius: 8, borderColor: "#e2e8f0", fontSize: 13 }} />
        <Bar dataKey="count" radius={[6, 6, 0, 0]}>
          {data.map((d) => (
            <Cell key={d.priority} fill={PRIORITY_COLORS[d.priority] ?? "#94a3b8"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
