"use client";

import { useEffect, useMemo, useState } from "react";
import { ATTENDANCE_CODES, getAttendanceCode, isAttendedSession } from "@/lib/attendance-codes";

type FormGroup = { id: string; name: string; yearGroup: string };

type RegisterEntry = {
  pupil: { id: string; firstName: string; lastName: string; preferredName: string | null };
  record: { statutoryCode: string; minutesLate: number | null; notes: string | null } | null;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function AttendancePage() {
  const [formGroups, setFormGroups] = useState<FormGroup[] | null>(null);
  const [formGroupId, setFormGroupId] = useState("");
  const [date, setDate] = useState(todayIso());
  const [attSession, setAttSession] = useState<"AM" | "PM">("AM");

  const [entries, setEntries] = useState<RegisterEntry[] | null>(null);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  useEffect(() => {
    fetch("/api/form-groups")
      .then((r) => r.json())
      .then((groups: FormGroup[]) => {
        setFormGroups(groups);
        if (groups.length > 0) setFormGroupId((prev) => prev || groups[0].id);
      });
  }, []);

  function loadRegister() {
    if (!formGroupId || !date || !attSession) return;
    const params = new URLSearchParams({ formGroupId, date, session: attSession });
    fetch(`/api/attendance?${params.toString()}`)
      .then((r) => r.json())
      .then((data: RegisterEntry[]) => {
        setEntries(data);
        const next: Record<string, string> = {};
        for (const e of data) {
          next[e.pupil.id] = e.record?.statutoryCode ?? "";
        }
        setCodes(next);
      });
  }

  useEffect(loadRegister, [formGroupId, date, attSession]);

  async function saveRegister() {
    if (!formGroupId) return;
    setSaving(true);
    setSavedMsg("");
    try {
      const entriesPayload = Object.entries(codes)
        .filter(([, code]) => code)
        .map(([pupilId, code]) => {
          const info = getAttendanceCode(code);
          return {
            pupilId,
            mark: info?.mark ?? "NOT_RECORDED",
            statutoryCode: code,
          };
        });
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formGroupId, date, session: attSession, entries: entriesPayload }),
      });
      if (res.ok) {
        setSavedMsg("Register saved.");
        loadRegister();
      }
    } finally {
      setSaving(false);
    }
  }

  const summary = useMemo(() => {
    if (!entries) return { present: 0, absent: 0, notRecorded: 0 };
    let present = 0;
    let absent = 0;
    let notRecorded = 0;
    for (const e of entries) {
      const code = codes[e.pupil.id];
      if (!code) {
        notRecorded += 1;
        continue;
      }
      const info = getAttendanceCode(code);
      if (info && isAttendedSession(info.mark)) present += 1;
      else absent += 1;
    }
    return { present, absent, notRecorded };
  }, [entries, codes]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Attendance register</h1>

      <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <label className="text-xs text-slate-600">
          Form group
          <select value={formGroupId} onChange={(e) => setFormGroupId(e.target.value)} className="mt-1 block rounded-md border border-slate-300 px-3 py-2 text-sm">
            {formGroups?.map((fg) => (
              <option key={fg.id} value={fg.id}>{fg.name}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-600">
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 block rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="text-xs text-slate-600">
          Session
          <select value={attSession} onChange={(e) => setAttSession(e.target.value as "AM" | "PM")} className="mt-1 block rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="AM">AM</option>
            <option value="PM">PM</option>
          </select>
        </label>
        <button
          onClick={saveRegister}
          disabled={saving || !formGroupId}
          className="ml-auto rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save register"}
        </button>
      </div>

      <div className="mt-3 flex gap-4 text-sm text-slate-700">
        <span><span className="font-semibold text-green-700">{summary.present}</span> present</span>
        <span><span className="font-semibold text-red-700">{summary.absent}</span> absent</span>
        <span><span className="font-semibold text-slate-500">{summary.notRecorded}</span> not yet recorded</span>
        {savedMsg && <span className="text-indigo-600">{savedMsg}</span>}
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="p-4">Pupil</th>
              <th className="p-4">Code</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {entries?.map((e) => (
              <tr key={e.pupil.id}>
                <td className="p-4 font-medium text-slate-900">
                  {e.pupil.lastName}, {e.pupil.preferredName || e.pupil.firstName}
                </td>
                <td className="p-4">
                  <select
                    value={codes[e.pupil.id] ?? ""}
                    onChange={(ev) => setCodes((prev) => ({ ...prev, [e.pupil.id]: ev.target.value }))}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                  >
                    <option value="">Not recorded</option>
                    {ATTENDANCE_CODES.map((c) => (
                      <option key={c.code} value={c.code}>{c.code} — {c.label}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
            {entries?.length === 0 && (
              <tr>
                <td colSpan={2} className="p-6 text-center text-sm text-slate-700">
                  No pupils in this form group.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
