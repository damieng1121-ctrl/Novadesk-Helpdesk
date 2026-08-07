"use client";

import { useEffect, useState } from "react";

type TrashData = {
  tickets: { id: string; number: number; subject: string; updatedAt: string }[];
  articles: { id: string; slug: string; title: string; updatedAt: string }[];
  assets: { id: string; tag: string; name: string; updatedAt: string }[];
  financeRecords: { id: string; poNumber: string; description: string; updatedAt: string }[];
};

type Tab = "tickets" | "articles" | "assets" | "financeRecords";

const TABS: { id: Tab; label: string }[] = [
  { id: "tickets", label: "Tickets" },
  { id: "articles", label: "KB articles" },
  { id: "assets", label: "Assets" },
  { id: "financeRecords", label: "Finance" },
];

const RESTORE_ENDPOINT: Record<Tab, (id: string) => string> = {
  tickets: (id) => `/api/tickets/${id}`,
  articles: (slug) => `/api/kb/${slug}`,
  assets: (id) => `/api/assets/${id}`,
  financeRecords: (id) => `/api/finance/${id}`,
};

export default function TrashBinPage() {
  const [data, setData] = useState<TrashData | null>(null);
  const [tab, setTab] = useState<Tab>("tickets");

  function load() {
    fetch("/api/trash")
      .then((r) => r.json())
      .then(setData);
  }
  useEffect(load, []);

  async function restore(key: string) {
    await fetch(RESTORE_ENDPOINT[tab](key), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDeleted: false }),
    });
    load();
  }

  async function permanentlyDelete(key: string) {
    if (!confirm("Permanently delete this? This can't be undone.")) return;
    await fetch(RESTORE_ENDPOINT[tab](key), { method: "DELETE" });
    load();
  }

  if (!data) return <p className="text-sm text-slate-700">Loading…</p>;

  const rows =
    tab === "tickets"
      ? data.tickets.map((t) => ({ key: t.id, primary: `#${t.number} ${t.subject}`, updatedAt: t.updatedAt }))
      : tab === "articles"
        ? data.articles.map((a) => ({ key: a.slug, primary: a.title, updatedAt: a.updatedAt }))
        : tab === "assets"
          ? data.assets.map((a) => ({ key: a.id, primary: `${a.tag} — ${a.name}`, updatedAt: a.updatedAt }))
          : data.financeRecords.map((f) => ({ key: f.id, primary: `${f.poNumber} — ${f.description}`, updatedAt: f.updatedAt }));

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Trash bin</h1>
      <p className="mt-1 text-sm text-slate-600">Restore items or delete them permanently.</p>

      <div className="mt-4 flex gap-2 border-b border-slate-200">
        {TABS.map((t) => {
          const count = data[t.id].length;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium ${
                tab === t.id ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-700 hover:text-slate-900"
              }`}
            >
              {t.label}
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
        {rows.length === 0 && <p className="p-6 text-sm text-slate-700">Nothing in the trash here.</p>}
        {rows.map((r) => (
          <div key={r.key} className="flex items-center justify-between p-4 text-sm">
            <div>
              <p className="font-medium text-slate-900">{r.primary}</p>
              <p className="text-xs text-slate-600">Deleted {new Date(r.updatedAt).toLocaleDateString("en-GB")}</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => restore(r.key)} className="text-indigo-600 hover:underline">
                Restore
              </button>
              <button onClick={() => permanentlyDelete(r.key)} className="text-red-600 hover:underline">
                Delete forever
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
