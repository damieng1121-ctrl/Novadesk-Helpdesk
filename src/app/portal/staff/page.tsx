"use client";

import { useEffect, useState } from "react";

type StaffType = "TEACHING" | "TEACHING_ASSISTANT" | "ADMIN" | "SITE" | "MIDDAY" | "SENCO" | "OTHER";

type StaffProfile = {
  id: string;
  staffType: StaffType;
  dbsCheckDate: string | null;
  dbsNumber: string | null;
  contractType: string | null;
  startDate: string | null;
  endDate: string | null;
  safeguardingTrainingDate: string | null;
};

type StaffMember = {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  jobTitle: string | null;
  isTeacher: boolean;
  staffProfile: StaffProfile | null;
};

type Draft = {
  staffType: StaffType;
  dbsCheckDate: string;
  dbsNumber: string;
  contractType: string;
  startDate: string;
  endDate: string;
  safeguardingTrainingDate: string;
};

const STAFF_TYPES: StaffType[] = ["TEACHING", "TEACHING_ASSISTANT", "ADMIN", "SITE", "MIDDAY", "SENCO", "OTHER"];

function toDateInput(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

function toIso(dateStr: string): string | undefined {
  return dateStr ? new Date(`${dateStr}T00:00:00.000Z`).toISOString() : undefined;
}

function draftFrom(member: StaffMember): Draft {
  const p = member.staffProfile;
  return {
    staffType: p?.staffType ?? "TEACHING",
    dbsCheckDate: toDateInput(p?.dbsCheckDate ?? null),
    dbsNumber: p?.dbsNumber ?? "",
    contractType: p?.contractType ?? "",
    startDate: toDateInput(p?.startDate ?? null),
    endDate: toDateInput(p?.endDate ?? null),
    safeguardingTrainingDate: toDateInput(p?.safeguardingTrainingDate ?? null),
  };
}

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  function load() {
    fetch("/api/staff-profiles")
      .then((r) => (r.ok ? r.json() : []))
      .then((members: StaffMember[]) => {
        setStaff(members);
        setDrafts(Object.fromEntries(members.map((m) => [m.id, draftFrom(m)])));
      });
  }

  useEffect(load, []);

  function updateDraft(userId: string, patch: Partial<Draft>) {
    setDrafts((prev) => ({ ...prev, [userId]: { ...prev[userId], ...patch } }));
  }

  async function save(userId: string) {
    const d = drafts[userId];
    if (!d) return;
    setSavingId(userId);
    try {
      await fetch("/api/staff-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          staffType: d.staffType,
          dbsCheckDate: toIso(d.dbsCheckDate) ?? null,
          dbsNumber: d.dbsNumber || null,
          contractType: d.contractType || null,
          startDate: toIso(d.startDate) ?? null,
          endDate: toIso(d.endDate) ?? null,
          safeguardingTrainingDate: toIso(d.safeguardingTrainingDate) ?? null,
        }),
      });
      load();
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Staff records</h1>
      <p className="mt-1 text-sm text-slate-700">DBS and safeguarding details are visible to admins only.</p>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="p-4">Staff member</th>
              <th className="p-4">Staff type</th>
              <th className="p-4">DBS check date</th>
              <th className="p-4">DBS number</th>
              <th className="p-4">Contract type</th>
              <th className="p-4">Start date</th>
              <th className="p-4">End date</th>
              <th className="p-4">Safeguarding training</th>
              <th className="p-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {staff?.map((m) => {
              const d = drafts[m.id];
              if (!d) return null;
              return (
                <tr key={m.id}>
                  <td className="p-4">
                    <p className="font-medium text-slate-900">{m.name ?? m.email}</p>
                    <p className="text-xs text-slate-600">{m.jobTitle ?? m.role}</p>
                  </td>
                  <td className="p-4">
                    <select value={d.staffType} onChange={(e) => updateDraft(m.id, { staffType: e.target.value as StaffType })} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
                      {STAFF_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-4">
                    <input type="date" value={d.dbsCheckDate} onChange={(e) => updateDraft(m.id, { dbsCheckDate: e.target.value })} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
                  </td>
                  <td className="p-4">
                    <input value={d.dbsNumber} onChange={(e) => updateDraft(m.id, { dbsNumber: e.target.value })} className="w-32 rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
                  </td>
                  <td className="p-4">
                    <input value={d.contractType} onChange={(e) => updateDraft(m.id, { contractType: e.target.value })} className="w-32 rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
                  </td>
                  <td className="p-4">
                    <input type="date" value={d.startDate} onChange={(e) => updateDraft(m.id, { startDate: e.target.value })} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
                  </td>
                  <td className="p-4">
                    <input type="date" value={d.endDate} onChange={(e) => updateDraft(m.id, { endDate: e.target.value })} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
                  </td>
                  <td className="p-4">
                    <input
                      type="date"
                      value={d.safeguardingTrainingDate}
                      onChange={(e) => updateDraft(m.id, { safeguardingTrainingDate: e.target.value })}
                      className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                    />
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => save(m.id)}
                      disabled={savingId === m.id}
                      className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {savingId === m.id ? "Saving…" : "Save"}
                    </button>
                  </td>
                </tr>
              );
            })}
            {staff?.length === 0 && (
              <tr>
                <td colSpan={9} className="p-6 text-center text-sm text-slate-700">
                  No staff found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
