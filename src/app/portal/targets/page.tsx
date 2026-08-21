"use client";

import { useEffect, useState } from "react";

type Status = "NOT_STARTED" | "IN_PROGRESS" | "ACHIEVED";

type Subject = { id: string; name: string };
type Pupil = { id: string; firstName: string; lastName: string };
type Target = {
  id: string;
  pupilId: string;
  subjectId: string | null;
  title: string;
  description: string | null;
  targetDate: string | null;
  status: Status;
  pupil: { firstName: string; lastName: string };
  subject: { name: string } | null;
  createdBy: { name: string | null; email: string | null };
};

const COLUMNS: { status: Status; label: string }[] = [
  { status: "NOT_STARTED", label: "Not started" },
  { status: "IN_PROGRESS", label: "In progress" },
  { status: "ACHIEVED", label: "Achieved" },
];

export default function TargetsPage() {
  const [subjects, setSubjects] = useState<Subject[] | null>(null);
  const [pupils, setPupils] = useState<Pupil[] | null>(null);
  const [targets, setTargets] = useState<Target[] | null>(null);
  const [filterPupilId, setFilterPupilId] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [pupilId, setPupilId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function loadReference() {
    fetch("/api/assessment-subjects").then((r) => r.json()).then(setSubjects);
    fetch("/api/pupils").then((r) => r.json()).then(setPupils);
  }

  function loadTargets() {
    const params = new URLSearchParams();
    if (filterPupilId) params.set("pupilId", filterPupilId);
    fetch(`/api/targets?${params.toString()}`)
      .then((r) => r.json())
      .then(setTargets);
  }

  useEffect(loadReference, []);
  useEffect(loadTargets, [filterPupilId]);

  async function createTarget(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetch("/api/targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pupilId,
          subjectId: subjectId || undefined,
          title,
          description: description || undefined,
          targetDate: targetDate ? new Date(targetDate).toISOString() : undefined,
        }),
      });
      setTitle("");
      setDescription("");
      setTargetDate("");
      setSubjectId("");
      setShowForm(false);
      loadTargets();
    } finally {
      setSubmitting(false);
    }
  }

  async function setStatus(id: string, status: Status) {
    await fetch(`/api/targets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    loadTargets();
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Pupil targets</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          {showForm ? "Cancel" : "New target"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={createTarget} className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
          <select required value={pupilId} onChange={(e) => setPupilId(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">Pupil…</option>
            {pupils?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.firstName} {p.lastName}
              </option>
            ))}
          </select>
          <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">Subject (optional)</option>
            {subjects?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Target title" className="sm:col-span-2 rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className="sm:col-span-2 rounded-md border border-slate-300 px-3 py-2 text-sm"
            rows={2}
          />
          <label className="text-xs font-medium text-slate-700">
            Target date
            <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <button type="submit" disabled={submitting} className="sm:col-span-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
            {submitting ? "Saving…" : "Save target"}
          </button>
        </form>
      )}

      <div className="mt-4">
        <select value={filterPupilId} onChange={(e) => setFilterPupilId(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">All pupils</option>
          {pupils?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.firstName} {p.lastName}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        {COLUMNS.map((col) => (
          <div key={col.status} className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">
              {col.label} <span className="text-slate-500">({targets?.filter((t) => t.status === col.status).length ?? 0})</span>
            </h2>
            <div className="mt-3 space-y-3">
              {targets
                ?.filter((t) => t.status === col.status)
                .map((t) => (
                  <div key={t.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <p className="text-sm font-medium text-slate-900">{t.title}</p>
                    <p className="text-xs text-slate-600">
                      {t.pupil.firstName} {t.pupil.lastName}
                      {t.subject ? ` · ${t.subject.name}` : ""}
                    </p>
                    {t.description && <p className="mt-1 text-xs text-slate-700">{t.description}</p>}
                    {t.targetDate && <p className="mt-1 text-xs text-slate-500">Due {new Date(t.targetDate).toLocaleDateString("en-GB")}</p>}
                    <select
                      value={t.status}
                      onChange={(e) => setStatus(t.id, e.target.value as Status)}
                      className="mt-2 w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                    >
                      {COLUMNS.map((c) => (
                        <option key={c.status} value={c.status}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              {targets?.filter((t) => t.status === col.status).length === 0 && <p className="text-xs text-slate-500">Nothing here.</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
