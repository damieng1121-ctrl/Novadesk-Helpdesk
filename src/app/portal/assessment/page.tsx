"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type Subject = { id: string; name: string; order: number };
type AcademicYear = { id: string; name: string; isCurrent: boolean };
type Pupil = { id: string; firstName: string; lastName: string };
type Result = {
  id: string;
  pupilId: string;
  subjectId: string;
  academicYearId: string;
  teacherId: string;
  term: string;
  attainment: string;
  effort: string | null;
  notes: string | null;
  date: string;
  pupil: { firstName: string; lastName: string };
  subject: { name: string };
  teacher: { name: string | null; email: string | null };
};

export default function AssessmentPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user.role === "TENANT_ADMIN" || session?.user.role === "SUPER_ADMIN";

  const [subjects, setSubjects] = useState<Subject[] | null>(null);
  const [academicYears, setAcademicYears] = useState<AcademicYear[] | null>(null);
  const [pupils, setPupils] = useState<Pupil[] | null>(null);
  const [results, setResults] = useState<Result[] | null>(null);

  const [filterPupilId, setFilterPupilId] = useState("");
  const [filterSubjectId, setFilterSubjectId] = useState("");
  const [filterYearId, setFilterYearId] = useState("");

  const [showSubjectForm, setShowSubjectForm] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState("");

  const [showResultForm, setShowResultForm] = useState(false);
  const [pupilId, setPupilId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [academicYearId, setAcademicYearId] = useState("");
  const [term, setTerm] = useState("");
  const [attainment, setAttainment] = useState("");
  const [effort, setEffort] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function loadReference() {
    fetch("/api/assessment-subjects").then((r) => r.json()).then(setSubjects);
    fetch("/api/academic-years").then((r) => r.json()).then((years) => {
      setAcademicYears(years);
      const current = years.find((y: AcademicYear) => y.isCurrent);
      if (current) setAcademicYearId((prev) => prev || current.id);
    });
    fetch("/api/pupils").then((r) => r.json()).then(setPupils);
  }

  function loadResults() {
    const params = new URLSearchParams();
    if (filterPupilId) params.set("pupilId", filterPupilId);
    if (filterSubjectId) params.set("subjectId", filterSubjectId);
    if (filterYearId) params.set("academicYearId", filterYearId);
    fetch(`/api/assessment-results?${params.toString()}`)
      .then((r) => r.json())
      .then(setResults);
  }

  useEffect(loadReference, []);
  useEffect(loadResults, [filterPupilId, filterSubjectId, filterYearId]);

  async function createSubject(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/assessment-subjects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newSubjectName }),
    });
    setNewSubjectName("");
    setShowSubjectForm(false);
    loadReference();
  }

  async function createResult(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetch("/api/assessment-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pupilId,
          subjectId,
          academicYearId,
          term,
          attainment,
          effort: effort || undefined,
          notes: notes || undefined,
        }),
      });
      setTerm("");
      setAttainment("");
      setEffort("");
      setNotes("");
      setShowResultForm(false);
      loadResults();
    } finally {
      setSubmitting(false);
    }
  }

  async function removeResult(id: string) {
    await fetch(`/api/assessment-results/${id}`, { method: "DELETE" });
    loadResults();
  }

  if (academicYears && academicYears.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Assessment</h1>
        <p className="mt-4 text-sm text-slate-700">Set up an academic year first.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Assessment</h1>
        <button
          onClick={() => setShowResultForm(!showResultForm)}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          {showResultForm ? "Cancel" : "Log result"}
        </button>
      </div>

      {isAdmin && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Subjects</h2>
            <button onClick={() => setShowSubjectForm(!showSubjectForm)} className="text-xs font-medium text-indigo-600 hover:underline">
              {showSubjectForm ? "Cancel" : "+ Add subject"}
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {subjects?.map((s) => (
              <span key={s.id} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                {s.name}
              </span>
            ))}
          </div>
          {showSubjectForm && (
            <form onSubmit={createSubject} className="mt-3 flex gap-2">
              <input
                required
                value={newSubjectName}
                onChange={(e) => setNewSubjectName(e.target.value)}
                placeholder="Subject name"
                className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <button type="submit" className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                Add
              </button>
            </form>
          )}
        </div>
      )}

      {showResultForm && (
        <form onSubmit={createResult} className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-3">
          <select required value={pupilId} onChange={(e) => setPupilId(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">Pupil…</option>
            {pupils?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.firstName} {p.lastName}
              </option>
            ))}
          </select>
          <select required value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">Subject…</option>
            {subjects?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select required value={academicYearId} onChange={(e) => setAcademicYearId(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">Academic year…</option>
            {academicYears?.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
          </select>
          <input required value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Term (e.g. Autumn 1)" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input required value={attainment} onChange={(e) => setAttainment(e.target.value)} placeholder="Attainment (e.g. Expected)" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input value={effort} onChange={(e) => setEffort(e.target.value)} placeholder="Effort (optional)" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            className="sm:col-span-3 rounded-md border border-slate-300 px-3 py-2 text-sm"
            rows={2}
          />
          <button type="submit" disabled={submitting} className="sm:col-span-3 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
            {submitting ? "Saving…" : "Save result"}
          </button>
        </form>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <select value={filterPupilId} onChange={(e) => setFilterPupilId(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">All pupils</option>
          {pupils?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.firstName} {p.lastName}
            </option>
          ))}
        </select>
        <select value={filterSubjectId} onChange={(e) => setFilterSubjectId(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">All subjects</option>
          {subjects?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select value={filterYearId} onChange={(e) => setFilterYearId(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">All years</option>
          {academicYears?.map((y) => (
            <option key={y.id} value={y.id}>
              {y.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="p-4">Pupil</th>
              <th className="p-4">Subject</th>
              <th className="p-4">Term</th>
              <th className="p-4">Attainment</th>
              <th className="p-4">Effort</th>
              <th className="p-4">Teacher</th>
              <th className="p-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {results?.map((r) => (
              <tr key={r.id}>
                <td className="p-4 font-medium text-slate-900">
                  {r.pupil.firstName} {r.pupil.lastName}
                </td>
                <td className="p-4 text-slate-600">{r.subject.name}</td>
                <td className="p-4 text-slate-600">{r.term}</td>
                <td className="p-4 text-slate-600">{r.attainment}</td>
                <td className="p-4 text-slate-600">{r.effort ?? "—"}</td>
                <td className="p-4 text-slate-600">{r.teacher.name ?? r.teacher.email}</td>
                <td className="p-4">
                  {(isAdmin || session?.user.id === r.teacherId) && (
                    <button onClick={() => removeResult(r.id)} className="text-xs text-red-600 hover:underline">
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {results?.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-sm text-slate-700">
                  No assessment results logged yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
