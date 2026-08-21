"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type Pupil = { id: string; firstName: string; lastName: string };

type BehaviourCategory = "ACHIEVEMENT" | "CONCERN" | "BULLYING" | "SAFEGUARDING";

type Incident = {
  id: string;
  date: string;
  category: BehaviourCategory;
  points: number;
  description: string;
  location: string | null;
  actionTaken: string | null;
  followUpRequired: boolean;
  followUpNotes: string | null;
  isConfidential: boolean;
  pupil: { firstName: string; lastName: string };
  recordedBy: { name: string | null; email: string | null };
};

type AccidentSeverity = "MINOR" | "MODERATE" | "SERIOUS";

type Accident = {
  id: string;
  date: string;
  time: string;
  location: string;
  description: string;
  injuryType: string | null;
  actionTaken: string;
  severity: AccidentSeverity;
  parentNotified: boolean;
  parentNotifiedAt: string | null;
  pupil: { firstName: string; lastName: string };
  reportedBy: { name: string | null; email: string | null };
};

const CATEGORY_STYLES: Record<BehaviourCategory, string> = {
  ACHIEVEMENT: "bg-green-100 text-green-700",
  CONCERN: "bg-amber-100 text-amber-700",
  BULLYING: "bg-red-100 text-red-700",
  SAFEGUARDING: "bg-red-100 text-red-700",
};

const SEVERITY_STYLES: Record<AccidentSeverity, string> = {
  MINOR: "bg-slate-100 text-slate-600",
  MODERATE: "bg-amber-100 text-amber-700",
  SERIOUS: "bg-red-100 text-red-700",
};

function pupilName(p: { firstName: string; lastName: string }) {
  return `${p.firstName} ${p.lastName}`;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB");
}

export default function BehaviourPage() {
  const [tab, setTab] = useState<"incidents" | "accidents">("incidents");

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Behaviour &amp; wellbeing</h1>
      <div className="mt-4 flex gap-1 rounded-lg bg-slate-100 p-1 w-fit">
        {(["incidents", "accidents"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize transition ${
              tab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-4">{tab === "incidents" ? <IncidentsTab /> : <AccidentsTab />}</div>
    </div>
  );
}

function IncidentsTab() {
  const { data: session } = useSession();
  const isAdmin = session?.user.role === "TENANT_ADMIN" || session?.user.role === "SUPER_ADMIN";

  const [pupils, setPupils] = useState<Pupil[]>([]);
  const [incidents, setIncidents] = useState<Incident[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [pupilId, setPupilId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState<BehaviourCategory>("CONCERN");
  const [points, setPoints] = useState("0");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [followUpRequired, setFollowUpRequired] = useState(false);
  const [followUpNotes, setFollowUpNotes] = useState("");

  function load() {
    fetch("/api/behaviour")
      .then((r) => r.json())
      .then(setIncidents);
    fetch("/api/pupils")
      .then((r) => r.json())
      .then((data) => setPupils(Array.isArray(data) ? data : []))
      .catch(() => setPupils([]));
  }
  useEffect(load, []);

  async function createIncident(e: React.FormEvent) {
    e.preventDefault();
    if (!pupilId) return;
    setSubmitting(true);
    try {
      await fetch("/api/behaviour", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pupilId,
          date,
          category,
          points: parseInt(points, 10) || 0,
          description,
          location: location || undefined,
          actionTaken: actionTaken || undefined,
          followUpRequired,
          followUpNotes: followUpNotes || undefined,
        }),
      });
      setPupilId("");
      setDescription("");
      setLocation("");
      setActionTaken("");
      setFollowUpRequired(false);
      setFollowUpNotes("");
      setPoints("0");
      setShowForm(false);
      load();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-700">{incidents ? `${incidents.length} incidents` : ""}</p>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          {showForm ? "Cancel" : "Log incident"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={createIncident} className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
          <select required value={pupilId} onChange={(e) => setPupilId(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">Select pupil…</option>
            {pupils.map((p) => (
              <option key={p.id} value={p.id}>
                {pupilName(p)}
              </option>
            ))}
          </select>
          <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <select value={category} onChange={(e) => setCategory(e.target.value as BehaviourCategory)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="ACHIEVEMENT">Achievement</option>
            <option value="CONCERN">Concern</option>
            <option value="BULLYING">Bullying</option>
            <option value="SAFEGUARDING">Safeguarding</option>
          </select>
          <input type="number" value={points} onChange={(e) => setPoints(e.target.value)} placeholder="Points" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input value={actionTaken} onChange={(e) => setActionTaken(e.target.value)} placeholder="Action taken" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <textarea required value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" className="sm:col-span-2 rounded-md border border-slate-300 px-3 py-2 text-sm" rows={3} />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={followUpRequired} onChange={(e) => setFollowUpRequired(e.target.checked)} />
            Follow-up required
          </label>
          {followUpRequired && (
            <input value={followUpNotes} onChange={(e) => setFollowUpNotes(e.target.value)} placeholder="Follow-up notes" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          )}
          {(category === "SAFEGUARDING" || category === "BULLYING") && (
            <p className="sm:col-span-2 text-xs text-red-700">This incident will be marked confidential automatically and hidden from non-admin staff.</p>
          )}
          <button type="submit" disabled={submitting} className="sm:col-span-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
            {submitting ? "Saving…" : "Save incident"}
          </button>
        </form>
      )}

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="p-4">Pupil</th>
              <th className="p-4">Date</th>
              <th className="p-4">Category</th>
              <th className="p-4">Points</th>
              <th className="p-4">Description</th>
              <th className="p-4">Recorded by</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {incidents?.map((i) => (
              <tr key={i.id}>
                <td className="p-4 font-medium text-slate-900">{pupilName(i.pupil)}</td>
                <td className="p-4 text-slate-600">{fmtDate(i.date)}</td>
                <td className="p-4">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${CATEGORY_STYLES[i.category]}`}>{i.category}</span>
                  {i.isConfidential && <span className="ml-1 text-xs text-red-600">confidential</span>}
                </td>
                <td className="p-4 text-slate-600">{i.points}</td>
                <td className="p-4 text-slate-600">
                  <p>{i.description}</p>
                  {i.location && <p className="text-xs text-slate-500">at {i.location}</p>}
                  {i.followUpRequired && <p className="text-xs text-amber-700">Follow-up required</p>}
                </td>
                <td className="p-4 text-slate-600">{i.recordedBy.name ?? i.recordedBy.email}</td>
              </tr>
            ))}
            {incidents?.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-sm text-slate-700">
                  No behaviour incidents logged yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {!isAdmin && <p className="mt-2 text-xs text-slate-500">Confidential incidents recorded by other staff are hidden from you.</p>}
    </div>
  );
}

function AccidentsTab() {
  const [pupils, setPupils] = useState<Pupil[]>([]);
  const [accidents, setAccidents] = useState<Accident[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [pupilId, setPupilId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [injuryType, setInjuryType] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [severity, setSeverity] = useState<AccidentSeverity>("MINOR");
  const [parentNotified, setParentNotified] = useState(false);

  function load() {
    fetch("/api/accidents")
      .then((r) => r.json())
      .then(setAccidents);
    fetch("/api/pupils")
      .then((r) => r.json())
      .then((data) => setPupils(Array.isArray(data) ? data : []))
      .catch(() => setPupils([]));
  }
  useEffect(load, []);

  async function createAccident(e: React.FormEvent) {
    e.preventDefault();
    if (!pupilId) return;
    setSubmitting(true);
    try {
      await fetch("/api/accidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pupilId,
          date,
          time,
          location,
          description,
          injuryType: injuryType || undefined,
          actionTaken,
          severity,
          parentNotified,
        }),
      });
      setPupilId("");
      setTime("");
      setLocation("");
      setDescription("");
      setInjuryType("");
      setActionTaken("");
      setSeverity("MINOR");
      setParentNotified(false);
      setShowForm(false);
      load();
    } finally {
      setSubmitting(false);
    }
  }

  async function markParentNotified(id: string) {
    await fetch(`/api/accidents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parentNotified: true }),
    });
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-700">{accidents ? `${accidents.length} accident reports` : ""}</p>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          {showForm ? "Cancel" : "Log accident"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={createAccident} className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
          <select required value={pupilId} onChange={(e) => setPupilId(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">Select pupil…</option>
            {pupils.map((p) => (
              <option key={p.id} value={p.id}>
                {pupilName(p)}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-1/2 rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <input required type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-1/2 rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <input required value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <select value={severity} onChange={(e) => setSeverity(e.target.value as AccidentSeverity)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="MINOR">Minor</option>
            <option value="MODERATE">Moderate</option>
            <option value="SERIOUS">Serious</option>
          </select>
          <input value={injuryType} onChange={(e) => setInjuryType(e.target.value)} placeholder="Injury type (optional)" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={parentNotified} onChange={(e) => setParentNotified(e.target.checked)} />
            Parent already notified
          </label>
          <textarea required value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What happened?" className="sm:col-span-2 rounded-md border border-slate-300 px-3 py-2 text-sm" rows={3} />
          <textarea required value={actionTaken} onChange={(e) => setActionTaken(e.target.value)} placeholder="Action taken" className="sm:col-span-2 rounded-md border border-slate-300 px-3 py-2 text-sm" rows={2} />
          <button type="submit" disabled={submitting} className="sm:col-span-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
            {submitting ? "Saving…" : "Save report"}
          </button>
        </form>
      )}

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="p-4">Pupil</th>
              <th className="p-4">Date / time</th>
              <th className="p-4">Severity</th>
              <th className="p-4">Description</th>
              <th className="p-4">Parent notified</th>
              <th className="p-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {accidents?.map((a) => (
              <tr key={a.id}>
                <td className="p-4 font-medium text-slate-900">{pupilName(a.pupil)}</td>
                <td className="p-4 text-slate-600">
                  {fmtDate(a.date)} {a.time}
                </td>
                <td className="p-4">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${SEVERITY_STYLES[a.severity]}`}>{a.severity}</span>
                </td>
                <td className="p-4 text-slate-600">
                  <p>{a.description}</p>
                  <p className="text-xs text-slate-500">at {a.location}</p>
                </td>
                <td className="p-4">
                  {a.parentNotified ? (
                    <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">Notified</span>
                  ) : (
                    <button onClick={() => markParentNotified(a.id)} className="text-xs text-indigo-600 hover:underline">
                      Mark notified
                    </button>
                  )}
                </td>
                <td className="p-4"></td>
              </tr>
            ))}
            {accidents?.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-sm text-slate-700">
                  No accident reports logged yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
