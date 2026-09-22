"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { SlideOver } from "@/components/slide-over";

type Holiday = { id: string; date: string; name: string };

export default function HolidaysAdminPage() {
  const [holidays, setHolidays] = useState<Holiday[] | null>(null);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    fetch("/api/admin/holidays")
      .then((r) => r.json())
      .then(setHolidays);
  }
  useEffect(load, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      setDate("");
      setName("");
      setOpen(false);
      load();
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(id: string) {
    await fetch(`/api/admin/holidays/${id}`, { method: "DELETE" });
    load();
  }

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = holidays?.filter((h) => h.date.slice(0, 10) >= today) ?? [];
  const past = holidays?.filter((h) => h.date.slice(0, 10) < today) ?? [];

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Holidays</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            A ticket raised on one of these dates is treated as out of hours, whatever the time — same as a
            weekend.
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <Plus size={16} />
          Add holiday
        </button>
      </div>

      <div className="mt-6 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
        {upcoming.map((h) => (
          <div key={h.id} className="flex items-center justify-between p-4">
            <div>
              <p className="font-medium text-slate-900 dark:text-slate-100">{h.name}</p>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {new Date(h.date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
            <button onClick={() => remove(h.id)} className="text-xs text-red-600 hover:underline">
              Delete
            </button>
          </div>
        ))}
        {holidays?.length === 0 && <p className="p-6 text-sm text-slate-700 dark:text-slate-300">No holidays added yet.</p>}
        {holidays !== null && holidays.length > 0 && upcoming.length === 0 && (
          <p className="p-6 text-sm text-slate-700 dark:text-slate-300">No upcoming holidays — all {holidays.length} added are in the past.</p>
        )}
      </div>

      {past.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100">
            {past.length} past {past.length === 1 ? "holiday" : "holidays"}
          </summary>
          <div className="mt-2 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
            {past.map((h) => (
              <div key={h.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">{h.name}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">{new Date(h.date).toLocaleDateString("en-GB")}</p>
                </div>
                <button onClick={() => remove(h.id)} className="text-xs text-red-600 hover:underline">
                  Delete
                </button>
              </div>
            ))}
          </div>
        </details>
      )}

      <SlideOver open={open} onClose={() => setOpen(false)} title="Add a holiday" description="Tickets raised on this date count as out of hours regardless of time.">
        <form onSubmit={create} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Date</label>
            <input
              required
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Early May bank holiday"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Add holiday"}
          </button>
        </form>
      </SlideOver>
    </div>
  );
}
