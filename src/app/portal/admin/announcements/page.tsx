"use client";

import { useEffect, useState } from "react";

type Announcement = {
  id: string;
  title: string;
  message: string;
  type: "INFO" | "WARNING" | "ALERT";
  targetAudience: "ALL" | "STAFF" | "REQUESTERS";
  active: boolean;
  createdAt: string;
};

const TYPE_STYLES: Record<Announcement["type"], string> = {
  INFO: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  WARNING: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  ALERT: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export default function AnnouncementsAdminPage() {
  const [announcements, setAnnouncements] = useState<Announcement[] | null>(null);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<Announcement["type"]>("INFO");
  const [targetAudience, setTargetAudience] = useState<Announcement["targetAudience"]>("ALL");
  const [submitting, setSubmitting] = useState(false);

  function load() {
    fetch("/api/announcements")
      .then((r) => r.json())
      .then(setAnnouncements);
  }
  useEffect(load, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, message, type, targetAudience }),
      });
      setTitle("");
      setMessage("");
      load();
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(id: string, active: boolean) {
    await fetch(`/api/announcements/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !active }),
    });
    load();
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Announcements</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Banners shown on the portal home page.</p>

      <form onSubmit={create} className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" />
        <textarea required value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Message" rows={2} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" />
        <div className="flex gap-3">
          <select value={type} onChange={(e) => setType(e.target.value as Announcement["type"])} className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500">
            <option value="INFO">Info</option>
            <option value="WARNING">Warning</option>
            <option value="ALERT">Alert</option>
          </select>
          <select value={targetAudience} onChange={(e) => setTargetAudience(e.target.value as Announcement["targetAudience"])} className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500">
            <option value="ALL">Everyone</option>
            <option value="STAFF">Staff only</option>
            <option value="REQUESTERS">Requesters only</option>
          </select>
        </div>
        <button type="submit" disabled={submitting} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
          {submitting ? "Posting…" : "Post announcement"}
        </button>
      </form>

      <div className="mt-6 space-y-3">
        {announcements?.map((a) => (
          <div key={a.id} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TYPE_STYLES[a.type]}`}>{a.type}</span>
                <p className="font-medium text-slate-900 dark:text-slate-100">{a.title}</p>
              </div>
              <button
                onClick={() => toggleActive(a.id, a.active)}
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${a.active ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"}`}
              >
                {a.active ? "Active" : "Inactive"}
              </button>
            </div>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{a.message}</p>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Audience: {a.targetAudience.toLowerCase()}</p>
          </div>
        ))}
        {announcements?.length === 0 && <p className="text-sm text-slate-700 dark:text-slate-300">No announcements yet.</p>}
      </div>
    </div>
  );
}
