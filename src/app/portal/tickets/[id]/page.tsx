"use client";

import { useEffect, useState, use as usePromise } from "react";
import { useSession } from "next-auth/react";
import { StatusBadge, PriorityBadge } from "@/components/badges";

type Person = { id: string; name: string | null; email: string | null };
type Comment = {
  id: string;
  body: string;
  isInternal: boolean;
  createdAt: string;
  author: Person & { role: string };
};
type TicketDetail = {
  id: string;
  number: number;
  subject: string;
  description: string;
  status: string;
  priority: string;
  aiSummary: string | null;
  aiSuggestedCategory: string | null;
  category: { id: string; name: string } | null;
  requester: Person;
  assignee: Person | null;
  comments: Comment[];
  createdAt: string;
};

const STAFF_ROLES = new Set(["AGENT", "TENANT_ADMIN", "SUPER_ADMIN"]);

export default function TicketDetailPage({ params }: PageProps<"/portal/tickets/[id]">) {
  const { id } = usePromise(params);
  const { data: session } = useSession();
  const staff = !!session?.user && STAFF_ROLES.has(session.user.role);

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [reply, setReply] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [posting, setPosting] = useState(false);

  async function load() {
    const res = await fetch(`/api/tickets/${id}`);
    if (res.ok) setTicket(await res.json());
  }

  useEffect(() => {
    fetch(`/api/tickets/${id}`).then((res) => (res.ok ? res.json() : null)).then((data) => {
      if (data) setTicket(data);
    });
  }, [id]);

  async function updateTicket(patch: Record<string, unknown>) {
    await fetch(`/api/tickets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    load();
  }

  async function postComment(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim()) return;
    setPosting(true);
    try {
      await fetch(`/api/tickets/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: reply, isInternal }),
      });
      setReply("");
      setIsInternal(false);
      load();
    } finally {
      setPosting(false);
    }
  }

  if (!ticket) return <p className="text-sm text-slate-500">Loading…</p>;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-slate-500">Ticket #{ticket.number}</p>
            <h1 className="text-2xl font-semibold text-slate-900">{ticket.subject}</h1>
          </div>
          <div className="flex gap-2">
            <StatusBadge status={ticket.status as never} />
            <PriorityBadge priority={ticket.priority as never} />
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
          <p className="whitespace-pre-wrap text-sm text-slate-700">{ticket.description}</p>
          <p className="mt-3 text-xs text-slate-400">
            Raised by {ticket.requester.name ?? ticket.requester.email} on{" "}
            {new Date(ticket.createdAt).toLocaleString("en-GB")}
          </p>
        </div>

        {ticket.aiSummary && (
          <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
            <p className="font-medium">AI summary</p>
            <p className="mt-1">{ticket.aiSummary}</p>
          </div>
        )}

        <div className="mt-6 space-y-4">
          {ticket.comments.map((c) => (
            <div
              key={c.id}
              className={`rounded-xl border p-4 text-sm ${
                c.isInternal ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="font-medium text-slate-900">
                  {c.author.name ?? c.author.email}
                  {c.isInternal && <span className="ml-2 text-xs font-normal text-amber-700">Internal note</span>}
                </p>
                <p className="text-xs text-slate-400">{new Date(c.createdAt).toLocaleString("en-GB")}</p>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-slate-700">{c.body}</p>
            </div>
          ))}
          {ticket.comments.length === 0 && <p className="text-sm text-slate-400">No replies yet.</p>}
        </div>

        <form onSubmit={postComment} className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
          <textarea
            rows={3}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Write a reply…"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          <div className="mt-3 flex items-center justify-between">
            {staff ? (
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} />
                Internal note (hidden from requester)
              </label>
            ) : (
              <span />
            )}
            <button
              type="submit"
              disabled={posting || !reply.trim()}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {posting ? "Posting…" : "Post reply"}
            </button>
          </div>
        </form>
      </div>

      {staff && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-medium text-slate-900">Status</p>
            <select
              value={ticket.status}
              onChange={(e) => updateTicket({ status: e.target.value })}
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              {["OPEN", "IN_PROGRESS", "ON_HOLD", "RESOLVED", "CLOSED"].map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ")}
                </option>
              ))}
            </select>

            <p className="mt-4 text-sm font-medium text-slate-900">Priority</p>
            <select
              value={ticket.priority}
              onChange={(e) => updateTicket({ priority: e.target.value })}
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {ticket.aiSuggestedCategory && !ticket.category && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
              <p className="font-medium text-slate-900">AI suggested category</p>
              <p className="mt-1 text-slate-600">{ticket.aiSuggestedCategory}</p>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            <p>
              <span className="font-medium text-slate-900">Requester:</span>{" "}
              {ticket.requester.name ?? ticket.requester.email}
            </p>
            <p className="mt-1">
              <span className="font-medium text-slate-900">Assignee:</span>{" "}
              {ticket.assignee?.name ?? "Unassigned"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
