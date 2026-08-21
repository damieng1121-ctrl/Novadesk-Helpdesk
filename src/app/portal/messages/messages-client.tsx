"use client";

import { useEffect, useState } from "react";

type FormGroup = { id: string; name: string };
type Pupil = { id: string; firstName: string; lastName: string };

type Audience = "ALL_PARENTS" | "YEAR_GROUP" | "FORM_GROUP" | "INDIVIDUAL";

type SentMessage = {
  id: string;
  subject: string;
  body: string;
  audience: Audience;
  audienceRef: string | null;
  sentAt: string;
  sender: { name: string | null; email: string | null };
  _count: { recipients: number };
};

const YEAR_GROUPS = [
  "NURSERY", "RECEPTION", "YEAR_1", "YEAR_2", "YEAR_3", "YEAR_4", "YEAR_5", "YEAR_6",
  "YEAR_7", "YEAR_8", "YEAR_9", "YEAR_10", "YEAR_11", "YEAR_12", "YEAR_13",
];

export function MessagesClient({ formGroups, pupils }: { formGroups: FormGroup[]; pupils: Pupil[] }) {
  const [messages, setMessages] = useState<SentMessage[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<Audience>("ALL_PARENTS");
  const [audienceRef, setAudienceRef] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch("/api/parent-messages")
      .then((r) => r.json())
      .then(setMessages);
  }
  useEffect(load, []);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/parent-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body, audience, audienceRef: audience === "ALL_PARENTS" ? undefined : audienceRef }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      setSubject("");
      setBody("");
      setAudience("ALL_PARENTS");
      setAudienceRef("");
      setShowForm(false);
      load();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Parent messages</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          {showForm ? "Cancel" : "Compose message"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={send} className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-5">
          <input required value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <textarea required value={body} onChange={(e) => setBody(e.target.value)} placeholder="Message" rows={5} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <select
              value={audience}
              onChange={(e) => {
                setAudience(e.target.value as Audience);
                setAudienceRef("");
              }}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="ALL_PARENTS">All parents</option>
              <option value="YEAR_GROUP">A year group</option>
              <option value="FORM_GROUP">A form group</option>
              <option value="INDIVIDUAL">A single pupil&apos;s guardians</option>
            </select>

            {audience === "YEAR_GROUP" && (
              <select required value={audienceRef} onChange={(e) => setAudienceRef(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
                <option value="" disabled>Choose a year group…</option>
                {YEAR_GROUPS.map((yg) => (
                  <option key={yg} value={yg}>{yg.replace("_", " ")}</option>
                ))}
              </select>
            )}
            {audience === "FORM_GROUP" && (
              <select required value={audienceRef} onChange={(e) => setAudienceRef(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
                <option value="" disabled>Choose a form group…</option>
                {formGroups.map((fg) => (
                  <option key={fg.id} value={fg.id}>{fg.name}</option>
                ))}
              </select>
            )}
            {audience === "INDIVIDUAL" && (
              <select required value={audienceRef} onChange={(e) => setAudienceRef(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
                <option value="" disabled>Choose a pupil…</option>
                {pupils.map((p) => (
                  <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>
                ))}
              </select>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={submitting} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
            {submitting ? "Sending…" : "Send message"}
          </button>
        </form>
      )}

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="p-4">Subject</th>
              <th className="p-4">Audience</th>
              <th className="p-4">Recipients</th>
              <th className="p-4">Sent</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {messages?.map((m) => (
              <tr key={m.id}>
                <td className="p-4">
                  <p className="font-medium text-slate-900">{m.subject}</p>
                  <p className="text-xs text-slate-700">{m.sender.name ?? m.sender.email}</p>
                </td>
                <td className="p-4 text-slate-600">{m.audience.replace("_", " ")}{m.audienceRef ? ` (${m.audienceRef})` : ""}</td>
                <td className="p-4 text-slate-600">{m._count.recipients}</td>
                <td className="p-4 text-slate-600">{new Date(m.sentAt).toLocaleString("en-GB")}</td>
              </tr>
            ))}
            {messages?.length === 0 && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-sm text-slate-700">No messages sent yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
