"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Data = {
  pupil: { id: string; firstName: string; lastName: string; preferredName: string | null; yearGroup: string; dob: string; formGroup: { name: string } | null };
  attendance: { percent: number | null; isPersistentAbsence: boolean; sessionsRecorded: number };
  behaviourIncidents: { id: string; date: string; category: string; points: number; description: string; location: string | null }[];
  send: { status: string; primaryNeed: string | null } | null;
};

const CATEGORY_STYLES: Record<string, string> = {
  ACHIEVEMENT: "bg-green-100 text-green-700",
  CONCERN: "bg-amber-100 text-amber-700",
  BULLYING: "bg-red-100 text-red-700",
  SAFEGUARDING: "bg-red-100 text-red-700",
};

export default function ParentChildPage() {
  const params = useParams<{ pupilId: string }>();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/parent/children/${params.pupilId}`)
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.error ?? "Couldn't load this child's record");
        }
        return r.json();
      })
      .then(setData)
      .catch((err) => setError(err.message));
  }, [params.pupilId]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <p className="text-sm text-slate-600">Loading…</p>;

  const { pupil, attendance, behaviourIncidents, send } = data;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">{pupil.preferredName || pupil.firstName} {pupil.lastName}</h1>
      <p className="mt-1 text-sm text-slate-600">
        {pupil.yearGroup.replace("_", " ")}
        {pupil.formGroup ? ` · ${pupil.formGroup.name}` : ""}
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-600">Attendance</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {attendance.percent !== null ? `${(attendance.percent * 100).toFixed(1)}%` : "—"}
          </p>
          <p className="mt-1 text-xs text-slate-600">{attendance.sessionsRecorded} sessions recorded</p>
          {attendance.isPersistentAbsence && (
            <p className="mt-2 text-xs font-medium text-amber-700">Below the 90% attendance threshold</p>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 sm:col-span-2">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-600">SEND</p>
          {send ? (
            <div className="mt-2">
              <p className="text-sm font-medium text-slate-900">{send.status.replace("_", " ")}</p>
              {send.primaryNeed && <p className="mt-1 text-sm text-slate-600">Primary need: {send.primaryNeed.replace("_", " ")}</p>}
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-600">No SEND record.</p>
          )}
        </div>
      </div>

      <h2 className="mt-8 text-lg font-semibold text-slate-900">Behaviour</h2>
      <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="p-4">Date</th>
              <th className="p-4">Category</th>
              <th className="p-4">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {behaviourIncidents.map((b) => (
              <tr key={b.id}>
                <td className="p-4 text-slate-600">{new Date(b.date).toLocaleDateString("en-GB")}</td>
                <td className="p-4">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${CATEGORY_STYLES[b.category] ?? "bg-slate-100 text-slate-600"}`}>
                    {b.category}
                  </span>
                </td>
                <td className="p-4 text-slate-700">{b.description}</td>
              </tr>
            ))}
            {behaviourIncidents.length === 0 && (
              <tr>
                <td colSpan={3} className="p-6 text-center text-sm text-slate-700">No behaviour records.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
