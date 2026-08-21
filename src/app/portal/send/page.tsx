"use client";

import { Fragment, useEffect, useState } from "react";

type SendStatus = "NONE" | "SEND_SUPPORT" | "EHCP";
type PrimaryNeed = "COMMUNICATION" | "COGNITION" | "SEMH" | "SENSORY_PHYSICAL";

type Target = { target: string; progress: string; reviewDate: string };

type SendPlan = {
  id: string;
  pupilId: string;
  status: SendStatus;
  primaryNeed: PrimaryNeed | null;
  description: string;
  targets: Target[];
  externalAgencies: string | null;
  reviewDate: string | null;
  pupil: { firstName: string; lastName: string; sendStatus: SendStatus };
  createdBy: { name: string | null; email: string | null };
};

type Pupil = { id: string; firstName: string; lastName: string; sendStatus: SendStatus };

const STATUS_STYLES: Record<SendStatus, string> = {
  NONE: "bg-slate-100 text-slate-600",
  SEND_SUPPORT: "bg-amber-100 text-amber-700",
  EHCP: "bg-indigo-100 text-indigo-700",
};

function pupilName(p: { firstName: string; lastName: string }) {
  return `${p.firstName} ${p.lastName}`;
}

export default function SendPage() {
  const [pupils, setPupils] = useState<Pupil[]>([]);
  const [plans, setPlans] = useState<SendPlan[] | null>(null);
  const [expandedPupilId, setExpandedPupilId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState<string | null>(null);

  function load() {
    fetch("/api/send")
      .then((r) => r.json())
      .then(setPlans);
    fetch("/api/pupils")
      .then((r) => r.json())
      .then((data) => setPupils(Array.isArray(data) ? data : []))
      .catch(() => setPupils([]));
  }
  useEffect(load, []);

  const sendPupils = pupils.filter((p) => p.sendStatus !== "NONE");
  const plansByPupil = new Map<string, SendPlan[]>();
  for (const plan of plans ?? []) {
    const list = plansByPupil.get(plan.pupilId) ?? [];
    list.push(plan);
    plansByPupil.set(plan.pupilId, list);
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">SEND</h1>
      <p className="mt-1 text-sm text-slate-700">{plans ? `${sendPupils.length} pupils with SEND status` : ""}</p>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="p-4">Pupil</th>
              <th className="p-4">Status</th>
              <th className="p-4">Plans</th>
              <th className="p-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sendPupils.map((p) => {
              const pupilPlans = plansByPupil.get(p.id) ?? [];
              const expanded = expandedPupilId === p.id;
              return (
                <Fragment key={p.id}>
                  <tr>
                    <td className="p-4 font-medium text-slate-900">{pupilName(p)}</td>
                    <td className="p-4">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[p.sendStatus]}`}>{p.sendStatus.replace("_", " ")}</span>
                    </td>
                    <td className="p-4 text-slate-600">{pupilPlans.length}</td>
                    <td className="p-4">
                      <button onClick={() => setExpandedPupilId(expanded ? null : p.id)} className="text-xs text-indigo-600 hover:underline">
                        {expanded ? "Collapse" : "View / edit"}
                      </button>
                    </td>
                  </tr>
                  {expanded && (
                    <tr>
                      <td colSpan={4} className="bg-slate-50 p-4">
                        <PupilSendDetail
                          pupilId={p.id}
                          plans={pupilPlans}
                          showNewForm={showNewForm === p.id}
                          onToggleNewForm={() => setShowNewForm(showNewForm === p.id ? null : p.id)}
                          onChanged={load}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {plans && sendPupils.length === 0 && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-sm text-slate-700">
                  No pupils currently on SEND support or EHCP.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <NewSendPlanPupilPicker pupils={pupils.filter((p) => (plansByPupil.get(p.id) ?? []).length === 0)} onCreated={load} />
    </div>
  );
}

function NewSendPlanPupilPicker({ pupils, onCreated }: { pupils: Pupil[]; onCreated: () => void }) {
  const [pupilId, setPupilId] = useState("");
  if (pupilId) {
    return <NewPlanForm pupilId={pupilId} onCancel={() => setPupilId("")} onCreated={() => { setPupilId(""); onCreated(); }} />;
  }
  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-sm font-medium text-slate-900">Start a new SEND plan</p>
      <select value={pupilId} onChange={(e) => setPupilId(e.target.value)} className="mt-2 rounded-md border border-slate-300 px-3 py-2 text-sm">
        <option value="">Select pupil…</option>
        {pupils.map((p) => (
          <option key={p.id} value={p.id}>
            {pupilName(p)}
          </option>
        ))}
      </select>
    </div>
  );
}

function TargetsEditor({ targets, onChange }: { targets: Target[]; onChange: (t: Target[]) => void }) {
  function update(i: number, field: keyof Target, value: string) {
    const next = targets.slice();
    next[i] = { ...next[i], [field]: value };
    onChange(next);
  }
  function remove(i: number) {
    onChange(targets.filter((_, idx) => idx !== i));
  }
  return (
    <div className="space-y-2">
      {targets.map((t, i) => (
        <div key={i} className="grid grid-cols-1 gap-2 rounded-md border border-slate-200 p-2 sm:grid-cols-4">
          <input value={t.target} onChange={(e) => update(i, "target", e.target.value)} placeholder="Target" className="rounded-md border border-slate-300 px-2 py-1 text-sm sm:col-span-2" />
          <input value={t.progress} onChange={(e) => update(i, "progress", e.target.value)} placeholder="Progress" className="rounded-md border border-slate-300 px-2 py-1 text-sm" />
          <div className="flex gap-1">
            <input type="date" value={t.reviewDate} onChange={(e) => update(i, "reviewDate", e.target.value)} className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm" />
            <button type="button" onClick={() => remove(i)} className="text-xs text-red-600">
              ✕
            </button>
          </div>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...targets, { target: "", progress: "", reviewDate: "" }])} className="text-xs text-indigo-600 hover:underline">
        + Add target
      </button>
    </div>
  );
}

function NewPlanForm({ pupilId, onCancel, onCreated }: { pupilId: string; onCancel: () => void; onCreated: () => void }) {
  const [status, setStatus] = useState<SendStatus>("SEND_SUPPORT");
  const [primaryNeed, setPrimaryNeed] = useState<PrimaryNeed | "">("");
  const [description, setDescription] = useState("");
  const [targets, setTargets] = useState<Target[]>([]);
  const [externalAgencies, setExternalAgencies] = useState("");
  const [reviewDate, setReviewDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pupilId,
          status,
          primaryNeed: primaryNeed || undefined,
          description,
          targets,
          externalAgencies: externalAgencies || undefined,
          reviewDate: reviewDate || undefined,
        }),
      });
      onCreated();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
      <select value={status} onChange={(e) => setStatus(e.target.value as SendStatus)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
        <option value="SEND_SUPPORT">SEND support</option>
        <option value="EHCP">EHCP</option>
      </select>
      <select value={primaryNeed} onChange={(e) => setPrimaryNeed(e.target.value as PrimaryNeed | "")} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
        <option value="">Primary need…</option>
        <option value="COMMUNICATION">Communication</option>
        <option value="COGNITION">Cognition</option>
        <option value="SEMH">SEMH</option>
        <option value="SENSORY_PHYSICAL">Sensory / physical</option>
      </select>
      <textarea required value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" className="sm:col-span-2 rounded-md border border-slate-300 px-3 py-2 text-sm" rows={3} />
      <div className="sm:col-span-2">
        <p className="mb-1 text-xs font-medium text-slate-600">Targets</p>
        <TargetsEditor targets={targets} onChange={setTargets} />
      </div>
      <input value={externalAgencies} onChange={(e) => setExternalAgencies(e.target.value)} placeholder="External agencies" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
      <input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
      <div className="sm:col-span-2 flex gap-2">
        <button type="submit" disabled={submitting} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
          {submitting ? "Saving…" : "Save plan"}
        </button>
        <button type="button" onClick={onCancel} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Cancel
        </button>
      </div>
    </form>
  );
}

function PupilSendDetail({
  pupilId,
  plans,
  showNewForm,
  onToggleNewForm,
  onChanged,
}: {
  pupilId: string;
  plans: SendPlan[];
  showNewForm: boolean;
  onToggleNewForm: () => void;
  onChanged: () => void;
}) {
  return (
    <div className="space-y-3">
      {plans.map((plan) => (
        <PlanCard key={plan.id} plan={plan} onChanged={onChanged} />
      ))}
      {showNewForm ? (
        <NewPlanForm pupilId={pupilId} onCancel={onToggleNewForm} onCreated={() => { onToggleNewForm(); onChanged(); }} />
      ) : (
        <button onClick={onToggleNewForm} className="text-xs text-indigo-600 hover:underline">
          + New SEND plan
        </button>
      )}
    </div>
  );
}

function PlanCard({ plan, onChanged }: { plan: SendPlan; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<SendStatus>(plan.status);
  const [primaryNeed, setPrimaryNeed] = useState<PrimaryNeed | "">(plan.primaryNeed ?? "");
  const [description, setDescription] = useState(plan.description);
  const [targets, setTargets] = useState<Target[]>(plan.targets ?? []);
  const [externalAgencies, setExternalAgencies] = useState(plan.externalAgencies ?? "");
  const [reviewDate, setReviewDate] = useState(plan.reviewDate ? plan.reviewDate.slice(0, 10) : "");
  const [submitting, setSubmitting] = useState(false);

  async function save() {
    setSubmitting(true);
    try {
      await fetch(`/api/send/${plan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          primaryNeed: primaryNeed || undefined,
          description,
          targets,
          externalAgencies: externalAgencies || undefined,
          reviewDate: reviewDate || undefined,
        }),
      });
      setEditing(false);
      onChanged();
    } finally {
      setSubmitting(false);
    }
  }

  if (!editing) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[plan.status]}`}>{plan.status.replace("_", " ")}</span>
            {plan.primaryNeed && <span className="ml-2 text-xs text-slate-600">{plan.primaryNeed.replace("_", " ")}</span>}
          </div>
          <button onClick={() => setEditing(true)} className="text-xs text-indigo-600 hover:underline">
            Edit
          </button>
        </div>
        <p className="mt-2 text-sm text-slate-700">{plan.description}</p>
        {plan.targets?.length > 0 && (
          <ul className="mt-2 space-y-1 text-xs text-slate-600">
            {plan.targets.map((t, i) => (
              <li key={i}>
                {t.target} — {t.progress || "no progress noted"} (review {t.reviewDate || "TBC"})
              </li>
            ))}
          </ul>
        )}
        {plan.externalAgencies && <p className="mt-2 text-xs text-slate-500">Agencies: {plan.externalAgencies}</p>}
        {plan.reviewDate && <p className="mt-1 text-xs text-slate-500">Review due: {new Date(plan.reviewDate).toLocaleDateString("en-GB")}</p>}
        <p className="mt-1 text-xs text-slate-400">Created by {plan.createdBy.name ?? plan.createdBy.email}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2">
      <select value={status} onChange={(e) => setStatus(e.target.value as SendStatus)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
        <option value="NONE">None</option>
        <option value="SEND_SUPPORT">SEND support</option>
        <option value="EHCP">EHCP</option>
      </select>
      <select value={primaryNeed} onChange={(e) => setPrimaryNeed(e.target.value as PrimaryNeed | "")} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
        <option value="">Primary need…</option>
        <option value="COMMUNICATION">Communication</option>
        <option value="COGNITION">Cognition</option>
        <option value="SEMH">SEMH</option>
        <option value="SENSORY_PHYSICAL">Sensory / physical</option>
      </select>
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="sm:col-span-2 rounded-md border border-slate-300 px-3 py-2 text-sm" rows={3} />
      <div className="sm:col-span-2">
        <p className="mb-1 text-xs font-medium text-slate-600">Targets</p>
        <TargetsEditor targets={targets} onChange={setTargets} />
      </div>
      <input value={externalAgencies} onChange={(e) => setExternalAgencies(e.target.value)} placeholder="External agencies" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
      <input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
      <div className="sm:col-span-2 flex gap-2">
        <button onClick={save} disabled={submitting} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
          {submitting ? "Saving…" : "Save changes"}
        </button>
        <button onClick={() => setEditing(false)} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Cancel
        </button>
      </div>
    </div>
  );
}
