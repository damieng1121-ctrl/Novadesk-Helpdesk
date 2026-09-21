"use client";

import { useEffect, useState, use as usePromise } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { StatusBadge, PriorityBadge } from "@/components/badges";
import { isOverdue } from "@/lib/sla";

type Person = { id: string; name: string | null; email: string | null };
type Attachment = { id: string; fileName: string; fileSize: number | null; commentId: string | null };
type Comment = {
  id: string;
  body: string;
  isInternal: boolean;
  createdAt: string;
  author: Person & { role: string };
  attachments: Attachment[];
};
type TicketDetail = {
  id: string;
  number: number;
  subject: string;
  description: string;
  status: string;
  priority: string;
  type: string;
  aiSummary: string | null;
  aiSuggestedCategory: string | null;
  sentimentScore: number | null;
  aiSuggestedSolution: string | null;
  category: { id: string; name: string } | null;
  brand: { id: string; name: string } | null;
  requester: Person;
  assignee: Person | null;
  comments: Comment[];
  attachments: Attachment[];
  createdAt: string;
  dueAt: string | null;
  isOutOfHours: boolean;
  tenant: { outOfHoursMessage: string };
};

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentList({ ticketId, attachments }: { ticketId: string; attachments: Attachment[] }) {
  if (attachments.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {attachments.map((a) => (
        <a
          key={a.id}
          href={`/api/tickets/${ticketId}/attachments/${a.id}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
          </svg>
          {a.fileName}
          {a.fileSize ? <span className="text-slate-600">({formatFileSize(a.fileSize)})</span> : null}
        </a>
      ))}
    </div>
  );
}

const STAFF_ROLES = new Set(["AGENT", "TENANT_ADMIN", "SUPER_ADMIN"]);

export default function TicketDetailPage({ params }: PageProps<"/portal/tickets/[id]">) {
  const { id } = usePromise(params);
  const { data: session } = useSession();
  const router = useRouter();
  const staff = !!session?.user && STAFF_ROLES.has(session.user.role);
  const isAdmin = session?.user.role === "TENANT_ADMIN" || session?.user.role === "SUPER_ADMIN";

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [reply, setReply] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [replyFile, setReplyFile] = useState<File | null>(null);
  const [posting, setPosting] = useState(false);
  const [cannedResponses, setCannedResponses] = useState<{ id: string; title: string; content: string }[]>([]);
  const [staffList, setStaffList] = useState<Person[]>([]);
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);

  async function load() {
    const res = await fetch(`/api/tickets/${id}`);
    if (res.ok) setTicket(await res.json());
  }

  useEffect(() => {
    fetch(`/api/tickets/${id}`).then((res) => (res.ok ? res.json() : null)).then((data) => {
      if (data) setTicket(data);
    });
  }, [id]);

  useEffect(() => {
    if (!staff) return;
    fetch("/api/canned-responses")
      .then((r) => (r.ok ? r.json() : []))
      .then(setCannedResponses);
    fetch("/api/staff")
      .then((r) => (r.ok ? r.json() : []))
      .then(setStaffList);
    fetch("/api/brands")
      .then((r) => (r.ok ? r.json() : []))
      .then(setBrands);
  }, [staff]);

  function insertCannedResponse(responseId: string) {
    const response = cannedResponses.find((r) => r.id === responseId);
    if (response) setReply((prev) => (prev ? `${prev}\n\n${response.content}` : response.content));
  }

  async function updateTicket(patch: Record<string, unknown>) {
    await fetch(`/api/tickets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    load();
  }

  async function moveToTrash() {
    if (!confirm("Move this ticket to the trash?")) return;
    await updateTicket({ isDeleted: true });
    router.push("/portal/tickets");
  }

  async function postComment(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim()) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/tickets/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: reply, isInternal }),
      });
      if (replyFile && res.ok) {
        const comment = await res.json();
        const form = new FormData();
        form.set("file", replyFile);
        form.set("commentId", comment.id);
        await fetch(`/api/tickets/${id}/attachments`, { method: "POST", body: form });
      }
      setReply("");
      setIsInternal(false);
      setReplyFile(null);
      load();
    } finally {
      setPosting(false);
    }
  }

  if (!ticket) return <p className="text-sm text-slate-700">Loading…</p>;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-slate-700">Ticket #{ticket.number}</p>
            <h1 className="text-2xl font-semibold text-slate-900">{ticket.subject}</h1>
          </div>
          <div className="flex gap-2">
            <StatusBadge status={ticket.status as never} />
            <PriorityBadge priority={ticket.priority as never} />
            {isOverdue(ticket.dueAt, ticket.status) && (
              <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">Overdue</span>
            )}
            {ticket.isOutOfHours && (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                Out of hours
              </span>
            )}
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
          <p className="whitespace-pre-wrap text-sm text-slate-700">{ticket.description}</p>
          <p className="mt-3 text-xs text-slate-600">
            Raised by {ticket.requester.name ?? ticket.requester.email} on{" "}
            {new Date(ticket.createdAt).toLocaleString("en-GB")}
            {ticket.dueAt && <> · SLA due {new Date(ticket.dueAt).toLocaleString("en-GB")}</>}
          </p>
          <AttachmentList ticketId={ticket.id} attachments={ticket.attachments.filter((a) => !a.commentId)} />
        </div>

        {ticket.isOutOfHours && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            {ticket.tenant.outOfHoursMessage}
          </div>
        )}

        {ticket.aiSummary && (
          <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-900">
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
                <p className="text-xs text-slate-600">{new Date(c.createdAt).toLocaleString("en-GB")}</p>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-slate-700">{c.body}</p>
              <AttachmentList ticketId={ticket.id} attachments={c.attachments} />
            </div>
          ))}
          {ticket.comments.length === 0 && <p className="text-sm text-slate-600">No replies yet.</p>}
        </div>

        <form onSubmit={postComment} className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
          <textarea
            rows={3}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Write a reply…"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
              <input
                type="file"
                className="hidden"
                onChange={(e) => setReplyFile(e.target.files?.[0] ?? null)}
              />
              <span className="rounded-md border border-slate-300 px-2.5 py-1 text-xs hover:bg-slate-50">
                {replyFile ? replyFile.name : "Attach file"}
              </span>
            </label>
            {staff && (
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} />
                Internal note (hidden from requester)
              </label>
            )}
            {staff && cannedResponses.length > 0 && (
              <select
                onChange={(e) => {
                  insertCannedResponse(e.target.value);
                  e.target.value = "";
                }}
                defaultValue=""
                className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600"
              >
                <option value="" disabled>
                  Insert canned response…
                </option>
                {cannedResponses.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="mt-3 flex items-center justify-end">
            <button
              type="submit"
              disabled={posting || !reply.trim()}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
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

            <p className="mt-4 text-sm font-medium text-slate-900">Type</p>
            <select
              value={ticket.type}
              onChange={(e) => updateTicket({ type: e.target.value })}
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              {["INCIDENT", "PROBLEM", "REQUEST", "INFORMATION", "TRAINING", "QUOTE"].map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0) + t.slice(1).toLowerCase()}
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

          {ticket.sentimentScore !== null && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
              <p className="font-medium text-slate-900">Requester sentiment</p>
              <div className="mt-2 flex items-center gap-2">
                <div className="h-2 flex-1 rounded-full bg-slate-100">
                  <div
                    className={`h-2 rounded-full ${
                      ticket.sentimentScore >= 70
                        ? "bg-red-500"
                        : ticket.sentimentScore >= 40
                          ? "bg-amber-500"
                          : "bg-green-500"
                    }`}
                    style={{ width: `${ticket.sentimentScore}%` }}
                  />
                </div>
                <span className="text-xs text-slate-700">{ticket.sentimentScore}/100 frustration</span>
              </div>
            </div>
          )}

          {ticket.aiSuggestedSolution && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-900">
              <p className="font-medium">AI suggested first step</p>
              <p className="mt-1">{ticket.aiSuggestedSolution}</p>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
            <p className="text-slate-600">
              <span className="font-medium text-slate-900">Requester:</span>{" "}
              {ticket.requester.name ?? ticket.requester.email}
            </p>
            <p className="mt-3 font-medium text-slate-900">Assignee</p>
            <select
              value={ticket.assignee?.id ?? ""}
              onChange={(e) => updateTicket({ assigneeId: e.target.value || null })}
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Unassigned</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name ?? s.email}
                </option>
              ))}
            </select>

            {brands.length > 0 && (
              <>
                <p className="mt-3 font-medium text-slate-900">Brand</p>
                <select
                  value={ticket.brand?.id ?? ""}
                  onChange={(e) => updateTicket({ brandId: e.target.value || null })}
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">None</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>

          {isAdmin && (
            <button
              onClick={moveToTrash}
              className="w-full rounded-md border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              Move to trash
            </button>
          )}
        </div>
      )}
    </div>
  );
}
