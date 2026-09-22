"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { SlideOver } from "@/components/slide-over";

type CannedResponse = { id: string; title: string; shortcut: string; content: string };

export default function CannedResponsesAdminPage() {
  const [responses, setResponses] = useState<CannedResponse[] | null>(null);
  const [open, setOpen] = useState(false);
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
      setOpen(false);
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
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Canned responses</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Saved reply templates agents can insert while replying to a ticket.</p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <Plus size={16} />
          Add response
        </button>
      </div>

      <div className="mt-6 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
        {responses?.map((r) => (
          <div key={r.id} className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-100">{r.title}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">/{r.shortcut}</p>
              </div>
              <button onClick={() => remove(r.id)} className="text-xs text-red-600 hover:underline">
                Delete
              </button>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-400">{r.content}</p>
          </div>
        ))}
        {responses?.length === 0 && <p className="p-6 text-sm text-slate-700 dark:text-slate-300">No canned responses yet.</p>}
      </div>

      <SlideOver open={open} onClose={() => setOpen(false)} title="Add a canned response" description="Saved reply text agents can insert with one click while replying to a ticket.">
        <form onSubmit={create} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Title</label>
            <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Password reset instructions" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Shortcut</label>
            <input required value={shortcut} onChange={(e) => setShortcut(e.target.value.toLowerCase())} placeholder="password-reset" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Response text</label>
            <textarea required value={content} onChange={(e) => setContent(e.target.value)} rows={6} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={submitting} className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
            {submitting ? "Saving…" : "Add response"}
          </button>
        </form>
      </SlideOver>
    </div>
  );
}
