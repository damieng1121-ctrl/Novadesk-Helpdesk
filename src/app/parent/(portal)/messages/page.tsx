"use client";

import { useEffect, useState } from "react";

type Recipient = {
  id: string;
  readAt: string | null;
  message: { id: string; subject: string; body: string; sentAt: string; sender: { name: string | null; email: string | null } };
};

export default function ParentMessagesPage() {
  const [recipients, setRecipients] = useState<Recipient[] | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function load() {
    fetch("/api/parent/messages")
      .then((r) => r.json())
      .then(setRecipients);
  }
  useEffect(load, []);

  async function open(recipient: Recipient) {
    setExpandedId(expandedId === recipient.id ? null : recipient.id);
    if (!recipient.readAt) {
      await fetch(`/api/parent/messages?id=${recipient.id}`, { method: "PATCH" });
      load();
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Messages</h1>

      <div className="mt-4 space-y-2">
        {recipients?.map((r) => (
          <div key={r.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <button onClick={() => open(r)} className="flex w-full items-center justify-between p-4 text-left">
              <div>
                <p className={`text-sm ${r.readAt ? "font-medium text-slate-700" : "font-semibold text-slate-900"}`}>
                  {!r.readAt && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-indigo-600" />}
                  {r.message.subject}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  From {r.message.sender.name ?? r.message.sender.email} · {new Date(r.message.sentAt).toLocaleString("en-GB")}
                </p>
              </div>
            </button>
            {expandedId === r.id && (
              <div className="border-t border-slate-100 p-4 text-sm whitespace-pre-wrap text-slate-700">{r.message.body}</div>
            )}
          </div>
        ))}
        {recipients?.length === 0 && <p className="text-sm text-slate-600">No messages yet.</p>}
      </div>
    </div>
  );
}
