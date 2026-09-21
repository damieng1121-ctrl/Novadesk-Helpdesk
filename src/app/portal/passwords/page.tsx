"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Plus, Eye, EyeOff, Copy, Check } from "lucide-react";
import { SlideOver } from "@/components/slide-over";

type Entry = {
  id: string;
  title: string;
  username: string | null;
  url: string | null;
  notes: string | null;
  createdBy: { name: string | null; email: string | null };
};

function RevealablePassword({ id }: { id: string }) {
  const [value, setValue] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function reveal() {
    if (value !== null) {
      setValue(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/passwords/${id}/reveal`);
      const data = await res.json();
      if (res.ok) setValue(data.password);
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    let toCopy = value;
    if (toCopy === null) {
      const res = await fetch(`/api/passwords/${id}/reveal`);
      const data = await res.json();
      if (!res.ok) return;
      toCopy = data.password;
    }
    await navigator.clipboard.writeText(toCopy!);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex items-center gap-2">
      <code className="rounded bg-slate-50 px-2 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
        {value !== null ? value : "••••••••••"}
      </code>
      <button onClick={reveal} disabled={loading} className="rounded-md border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500">
        {value !== null ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
      <button onClick={copy} className="rounded-md border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500">
        {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
      </button>
    </div>
  );
}

export default function PasswordsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user.role === "TENANT_ADMIN" || session?.user.role === "SUPER_ADMIN";

  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    fetch("/api/passwords")
      .then((r) => r.json())
      .then(setEntries);
  }
  useEffect(load, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/passwords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          username: username || undefined,
          password,
          url: url || undefined,
          notes: notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      setTitle("");
      setUsername("");
      setPassword("");
      setUrl("");
      setNotes("");
      setOpen(false);
      load();
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(id: string, entryTitle: string) {
    if (!confirm(`Delete "${entryTitle}"? This can't be undone.`)) return;
    await fetch(`/api/passwords/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Passwords</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Shared credentials for the IT team — admin consoles, vendor logins. Encrypted at rest; every reveal is
            logged.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setOpen(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Plus size={16} />
            Add entry
          </button>
        )}
      </div>

      <div className="mt-6 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
        {entries?.map((entry) => (
          <div key={entry.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-slate-900 dark:text-slate-100">{entry.title}</p>
                {entry.username && <p className="text-xs text-slate-600 dark:text-slate-400">{entry.username}</p>}
                {entry.url && (
                  <a href={entry.url} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline">
                    {entry.url}
                  </a>
                )}
              </div>
              {isAdmin && (
                <button onClick={() => remove(entry.id, entry.title)} className="shrink-0 text-xs text-red-600 hover:underline">
                  Delete
                </button>
              )}
            </div>
            <div className="mt-2">
              <RevealablePassword id={entry.id} />
            </div>
            {entry.notes && <p className="mt-2 whitespace-pre-wrap text-xs text-slate-600 dark:text-slate-400">{entry.notes}</p>}
          </div>
        ))}
        {entries?.length === 0 && <p className="p-6 text-sm text-slate-700 dark:text-slate-300">No password entries yet.</p>}
      </div>

      <SlideOver open={open} onClose={() => setOpen(false)} title="Add a password entry" description="Shared with all technicians and admins — encrypted at rest.">
        <form onSubmit={create} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Title</label>
            <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Google Admin Console" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Username (optional)</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Password</label>
            <input required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">URL (optional)</label>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Notes (optional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={submitting} className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
            {submitting ? "Saving…" : "Add entry"}
          </button>
        </form>
      </SlideOver>
    </div>
  );
}
