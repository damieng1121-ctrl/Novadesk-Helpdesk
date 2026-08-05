"use client";

import { useEffect, useState } from "react";

type CannedResponse = { id: string; title: string; shortcut: string; content: string };

export default function CannedResponsesAdminPage() {
  const [responses, setResponses] = useState<CannedResponse[] | null>(null);
  const [title, setTitle] = useState("");
  const [shortcut, setShortcut] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    fetch("/api/canned-responses")
      .then((r) => r.json())
      .then(setResponses);
  }
  useEffect(load, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/canned-responses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, shortcut, content }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      setTitle("");
      setShortcut("");
      setContent("");
      load();
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(id: string) {
    await fetch(`/api/canned-responses/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-slate-900">Canned responses</h1>
      <p className="mt-1 text-sm text-slate-600">Saved reply templates agents can insert while replying to a ticket.</p>

      <form onSubmit={create} className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-white p-5">
        <div className="grid grid-cols-2 gap-3">
          <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input required value={shortcut} onChange={(e) => setShortcut(e.target.value.toLowerCase())} placeholder="shortcut-name" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <textarea required value={content} onChange={(e) => setContent(e.target.value)} placeholder="Response text…" rows={4} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={submitting} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {submitting ? "Saving…" : "Add response"}
        </button>
      </form>

      <div className="mt-6 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
        {responses?.map((r) => (
          <div key={r.id} className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">{r.title}</p>
                <p className="text-xs text-slate-600">/{r.shortcut}</p>
              </div>
              <button onClick={() => remove(r.id)} className="text-xs text-red-600 hover:underline">
                Delete
              </button>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{r.content}</p>
          </div>
        ))}
        {responses?.length === 0 && <p className="p-6 text-sm text-slate-700">No canned responses yet.</p>}
      </div>
    </div>
  );
}
