"use client";

import { useEffect, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  Legend,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

/** Recharts' SVG stroke/fill/tooltip colors are inline props, not Tailwind
 * classes, so they can't pick up `dark:` automatically — this tracks the
 * `dark` class on <html> (toggled by ThemeToggle) so charts can pick
 * matching colors themselves. */
function useIsDarkMode(): boolean {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const update = () => setIsDark(root.classList.contains("dark"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return isDark;
}

function chartTheme(isDark: boolean) {
  return {
    grid: isDark ? "#334155" : "#e2e8f0",
    tick: isDark ? "#94a3b8" : "#475569",
    tooltip: {
      borderRadius: 8,
      borderColor: isDark ? "#334155" : "#e2e8f0",
      backgroundColor: isDark ? "#0f172a" : "#ffffff",
      color: isDark ? "#e2e8f0" : "#0f172a",
      fontSize: 13,
    },
  };
}

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
  const theme = chartTheme(useIsDarkMode());
  const data = byStatus
    .filter((s) => s.count > 0)
    .map((s) => ({ ...s, label: s.status.replace("_", " ") }));
  if (data.length === 0) {
    return <p className="flex h-56 items-center justify-center text-sm text-slate-600 dark:text-slate-400">No tickets yet.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={224}>
      <PieChart>
        <Pie data={data} dataKey="count" nameKey="label" innerRadius={55} outerRadius={85} paddingAngle={2}>
          {data.map((s) => (
            <Cell key={s.status} fill={STATUS_COLORS[s.status] ?? "#94a3b8"} />
          ))}
        </Pie>
        <Tooltip contentStyle={theme.tooltip} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function VolumeByPriorityChart({ byPriority }: { byPriority: { priority: string; count: number }[] }) {
  const theme = chartTheme(useIsDarkMode());
  const order = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
  const data = order.map((priority) => ({
    priority,
    count: byPriority.find((p) => p.priority === priority)?.count ?? 0,
  }));
  return (
    <ResponsiveContainer width="100%" height={224}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.grid} />
        <XAxis dataKey="priority" tick={{ fontSize: 12, fill: theme.tick }} axisLine={{ stroke: theme.grid }} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: theme.tick }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={theme.tooltip} />
        <Bar dataKey="count" radius={[6, 6, 0, 0]}>
          {data.map((d) => (
            <Cell key={d.priority} fill={PRIORITY_COLORS[d.priority] ?? "#94a3b8"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// Created uses the app's brand indigo; resolved reuses the same green as
// the "RESOLVED" status elsewhere on this page — same meaning, same colour.
const CREATED_COLOR = "#6366f1";
const RESOLVED_COLOR = "#22c55e";

export function TicketVolumeTrendChart({
  data,
}: {
  data: { label: string; created: number; resolved: number }[];
}) {
  const isDark = useIsDarkMode();
  const theme = chartTheme(isDark);
  if (data.length === 0) {
    return <p className="flex h-64 items-center justify-center text-sm text-slate-600 dark:text-slate-400">No tickets in this range yet.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.grid} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: theme.tick }} axisLine={{ stroke: theme.grid }} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: theme.tick }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={theme.tooltip} />
        <Legend wrapperStyle={{ fontSize: 13, color: isDark ? "#e2e8f0" : undefined }} />
        <Line type="monotone" dataKey="created" name="Created" stroke={CREATED_COLOR} strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="resolved" name="Resolved" stroke={RESOLVED_COLOR} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
