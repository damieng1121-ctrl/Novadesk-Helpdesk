"use client";

import { useEffect, useState } from "react";
import { ComplianceBadge } from "@/components/badges";

type Assessment = {
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLIANT" | "NON_COMPLIANT" | "NOT_APPLICABLE";
  evidenceNotes: string | null;
  evidenceUrl: string | null;
  nextReviewDue: string | null;
};
type Item = {
  id: string;
  code: string;
  title: string;
  description: string;
  guidance: string | null;
  priority: "HIGH" | "MEDIUM" | "LOW";
  govLink: string | null;
  assessment: Assessment;
};

const PRIORITY_STYLES: Record<Item["priority"], string> = {
  HIGH: "bg-red-50 text-red-700",
  MEDIUM: "bg-amber-50 text-amber-700",
  LOW: "bg-slate-100 text-slate-700",
};
type Standard = { id: string; code: string; title: string; description: string; officialUrl: string | null; items: Item[] };

export default function CompliancePage() {
  const [standards, setStandards] = useState<Standard[] | null>(null);
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [emailState, setEmailState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  function load() {
    fetch("/api/compliance")
      .then((r) => r.json())
      .then(setStandards);
  }

  useEffect(load, []);

  async function emailReport() {
    setEmailState("sending");
    try {
      const res = await fetch("/api/compliance/report", { method: "POST" });
      if (!res.ok) throw new Error("failed");
      setEmailState("sent");
    } catch {
      setEmailState("error");
    } finally {
      setTimeout(() => setEmailState("idle"), 4000);
    }
  }

  if (!standards) return <p className="text-sm text-slate-700">Loading…</p>;

  const allItems = standards.flatMap((s) => s.items);
  const compliant = allItems.filter((i) => i.assessment.status === "COMPLIANT").length;
  const overallPct = allItems.length ? Math.round((compliant / allItems.length) * 100) : 0;

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">DfE digital &amp; technology standards</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Track your school&apos;s readiness against the DfE&apos;s digital and technology standards for
            schools and colleges. This is a working self-assessment tool — always check{" "}
            <a href="https://www.gov.uk/guidance/meeting-digital-and-technology-standards-in-schools-and-colleges" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
              the latest official guidance on GOV.UK
            </a>{" "}
            before reporting compliance externally.
          </p>
        </div>
        <button
          onClick={emailReport}
          disabled={emailState === "sending"}
          className="shrink-0 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {emailState === "sending" ? "Sending…" : emailState === "sent" ? "Sent ✓" : emailState === "error" ? "Failed — try again" : "Email me this report"}
        </button>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between text-sm">
          <p className="font-medium text-slate-900">Overall readiness</p>
          <p className="text-slate-700">
            {compliant} / {allItems.length} standards met
          </p>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-green-500" style={{ width: `${overallPct}%` }} />
        </div>
      </div>

      <div className="mt-6 space-y-6">
        {standards.map((standard) => {
          const standardCompliant = standard.items.filter((i) => i.assessment.status === "COMPLIANT").length;
          return (
            <div key={standard.id} className="rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 p-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-slate-900">{standard.title}</h2>
                  <p className="text-xs text-slate-600">
                    {standardCompliant}/{standard.items.length} met
                  </p>
                </div>
                <p className="mt-1 text-sm text-slate-600">{standard.description}</p>
                {standard.officialUrl && (
                  <a href={standard.officialUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-indigo-600 hover:underline">
                    Official DfE guidance ↗
                  </a>
                )}
              </div>
              <div className="divide-y divide-slate-100">
                {standard.items.map((item) => (
                  <ComplianceItemRow
                    key={item.id}
                    item={item}
                    open={openItem === item.id}
                    onToggle={() => setOpenItem(openItem === item.id ? null : item.id)}
                    onSaved={load}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ComplianceItemRow({
  item,
  open,
  onToggle,
  onSaved,
}: {
  item: Item;
  open: boolean;
  onToggle: () => void;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState(item.assessment.status);
  const [notes, setNotes] = useState(item.assessment.evidenceNotes ?? "");
  const [evidenceUrl, setEvidenceUrl] = useState(item.assessment.evidenceUrl ?? "");
  const [nextReviewDue, setNextReviewDue] = useState(item.assessment.nextReviewDue?.slice(0, 10) ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await fetch(`/api/compliance/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, evidenceNotes: notes, evidenceUrl, nextReviewDue: nextReviewDue || undefined }),
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-5">
      <button onClick={onToggle} className="flex w-full items-center justify-between text-left">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium text-slate-900">{item.title}</p>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLES[item.priority]}`}>
              {item.priority}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-slate-700">{item.description}</p>
        </div>
        <ComplianceBadge status={item.assessment.status} />
      </button>

      {open && (
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          {item.guidance && <p className="text-sm text-slate-600">{item.guidance}</p>}
          {item.govLink && (
            <a href={item.govLink} target="_blank" rel="noreferrer" className="inline-block text-xs text-indigo-600 hover:underline">
              Specific DfE guidance for this item ↗
            </a>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Assessment["status"])}
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              >
                <option value="NOT_STARTED">Not started</option>
                <option value="IN_PROGRESS">In progress</option>
                <option value="COMPLIANT">Compliant</option>
                <option value="NON_COMPLIANT">Non-compliant</option>
                <option value="NOT_APPLICABLE">Not applicable</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Next review due</label>
              <input
                type="date"
                value={nextReviewDue}
                onChange={(e) => setNextReviewDue(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Evidence / notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              placeholder="e.g. link to policy document, contract, or a description of current setup"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Evidence URL (optional)</label>
            <input
              value={evidenceUrl}
              onChange={(e) => setEvidenceUrl(e.target.value)}
              placeholder="https://…"
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      )}
    </div>
  );
}
