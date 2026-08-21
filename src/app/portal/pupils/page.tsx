"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

type YearGroup =
  | "NURSERY" | "RECEPTION" | "YEAR_1" | "YEAR_2" | "YEAR_3" | "YEAR_4" | "YEAR_5"
  | "YEAR_6" | "YEAR_7" | "YEAR_8" | "YEAR_9" | "YEAR_10" | "YEAR_11" | "YEAR_12" | "YEAR_13";

const YEAR_GROUPS: YearGroup[] = [
  "NURSERY", "RECEPTION", "YEAR_1", "YEAR_2", "YEAR_3", "YEAR_4", "YEAR_5",
  "YEAR_6", "YEAR_7", "YEAR_8", "YEAR_9", "YEAR_10", "YEAR_11", "YEAR_12", "YEAR_13",
];

function yearGroupLabel(yg: YearGroup): string {
  if (yg === "NURSERY") return "Nursery";
  if (yg === "RECEPTION") return "Reception";
  return `Year ${yg.replace("YEAR_", "")}`;
}

type Pupil = {
  id: string;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  yearGroup: YearGroup;
  sendStatus: "NONE" | "SEND_SUPPORT" | "EHCP";
  pupilPremium: boolean;
  freeSchoolMeals: boolean;
  formGroup: { id: string; name: string } | null;
};

type FormGroup = { id: string; name: string; yearGroup: YearGroup; academicYear: { id: string; name: string; isCurrent: boolean } };
type AcademicYear = { id: string; name: string; isCurrent: boolean };

const SEND_STYLES: Record<Pupil["sendStatus"], string> = {
  NONE: "",
  SEND_SUPPORT: "bg-amber-100 text-amber-700",
  EHCP: "bg-purple-100 text-purple-700",
};

export default function PupilsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user.role === "TENANT_ADMIN" || session?.user.role === "SUPER_ADMIN";

  const [pupils, setPupils] = useState<Pupil[] | null>(null);
  const [formGroups, setFormGroups] = useState<FormGroup[] | null>(null);
  const [academicYears, setAcademicYears] = useState<AcademicYear[] | null>(null);
  const [search, setSearch] = useState("");
  const [formGroupFilter, setFormGroupFilter] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState<"MALE" | "FEMALE">("MALE");
  const [yearGroup, setYearGroup] = useState<YearGroup>("RECEPTION");
  const [formGroupId, setFormGroupId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [showSetup, setShowSetup] = useState(false);
  const [yearName, setYearName] = useState("");
  const [yearStart, setYearStart] = useState("");
  const [yearEnd, setYearEnd] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupYearGroup, setGroupYearGroup] = useState<YearGroup>("RECEPTION");
  const [settingUp, setSettingUp] = useState(false);

  function load() {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (formGroupFilter) params.set("formGroupId", formGroupFilter);
    fetch(`/api/pupils?${params.toString()}`)
      .then((r) => r.json())
      .then(setPupils);
  }
  function loadRefs() {
    fetch("/api/form-groups").then((r) => r.json()).then(setFormGroups);
    fetch("/api/academic-years").then((r) => r.json()).then(setAcademicYears);
  }

  useEffect(loadRefs, []);
  useEffect(load, [search, formGroupFilter]);

  async function createPupil(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetch("/api/pupils", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          dob,
          gender,
          yearGroup,
          formGroupId: formGroupId || undefined,
        }),
      });
      setFirstName("");
      setLastName("");
      setDob("");
      setFormGroupId("");
      setShowForm(false);
      load();
    } finally {
      setSubmitting(false);
    }
  }

  async function setupFirstYear(e: React.FormEvent) {
    e.preventDefault();
    setSettingUp(true);
    try {
      const year = await fetch("/api/academic-years", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: yearName, startDate: yearStart, endDate: yearEnd, isCurrent: true }),
      }).then((r) => r.json());

      await fetch("/api/form-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ academicYearId: year.id, name: groupName, yearGroup: groupYearGroup }),
      });

      setYearName("");
      setYearStart("");
      setYearEnd("");
      setGroupName("");
      setShowSetup(false);
      loadRefs();
    } finally {
      setSettingUp(false);
    }
  }

  const needsSetup = academicYears !== null && academicYears.length === 0;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Pupils</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          {showForm ? "Cancel" : "Add pupil"}
        </button>
      </div>
      <p className="mt-1 text-sm text-slate-700">{pupils ? `${pupils.length} pupil${pupils.length === 1 ? "" : "s"}` : ""}</p>

      {needsSetup && isAdmin && (
        <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-indigo-900">Set up your first academic year &amp; form group</h2>
            <button onClick={() => setShowSetup(!showSetup)} className="text-sm text-indigo-700 hover:underline">
              {showSetup ? "Cancel" : "Get started"}
            </button>
          </div>
          <p className="mt-1 text-sm text-indigo-800">You need at least one academic year and form group before adding pupils.</p>
          {showSetup && (
            <form onSubmit={setupFirstYear} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input required value={yearName} onChange={(e) => setYearName(e.target.value)} placeholder="Year name, e.g. 2025/2026" className="rounded-md border border-slate-300 px-3 py-2 text-sm sm:col-span-2" />
              <label className="text-xs text-slate-600">
                Start date
                <input required type="date" value={yearStart} onChange={(e) => setYearStart(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </label>
              <label className="text-xs text-slate-600">
                End date
                <input required type="date" value={yearEnd} onChange={(e) => setYearEnd(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </label>
              <input required value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Form group name, e.g. 3W" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
              <select value={groupYearGroup} onChange={(e) => setGroupYearGroup(e.target.value as YearGroup)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
                {YEAR_GROUPS.map((yg) => (
                  <option key={yg} value={yg}>{yearGroupLabel(yg)}</option>
                ))}
              </select>
              <button type="submit" disabled={settingUp} className="sm:col-span-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
                {settingUp ? "Setting up…" : "Create academic year & form group"}
              </button>
            </form>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name…"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm sm:max-w-xs"
        />
        <select
          value={formGroupFilter}
          onChange={(e) => setFormGroupFilter(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All form groups</option>
          {formGroups?.map((fg) => (
            <option key={fg.id} value={fg.id}>{fg.name} ({yearGroupLabel(fg.yearGroup)})</option>
          ))}
        </select>
      </div>

      {showForm && (
        <form onSubmit={createPupil} className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
          <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input required value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <label className="text-xs text-slate-600">
            Date of birth
            <input required type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <select value={gender} onChange={(e) => setGender(e.target.value as "MALE" | "FEMALE")} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
          </select>
          <select value={yearGroup} onChange={(e) => setYearGroup(e.target.value as YearGroup)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            {YEAR_GROUPS.map((yg) => (
              <option key={yg} value={yg}>{yearGroupLabel(yg)}</option>
            ))}
          </select>
          <select value={formGroupId} onChange={(e) => setFormGroupId(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">No form group</option>
            {formGroups?.map((fg) => (
              <option key={fg.id} value={fg.id}>{fg.name}</option>
            ))}
          </select>
          <button type="submit" disabled={submitting} className="sm:col-span-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
            {submitting ? "Adding…" : "Add pupil"}
          </button>
        </form>
      )}

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="p-4">Name</th>
              <th className="p-4">Year group</th>
              <th className="p-4">Form group</th>
              <th className="p-4">SEND</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pupils?.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="p-4">
                  <Link href={`/portal/pupils/${p.id}`} className="font-medium text-slate-900 hover:text-indigo-600 hover:underline">
                    {p.lastName}, {p.preferredName || p.firstName}
                  </Link>
                  <div className="mt-0.5 flex gap-1">
                    {p.pupilPremium && <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">PP</span>}
                    {p.freeSchoolMeals && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">FSM</span>}
                  </div>
                </td>
                <td className="p-4 text-slate-600">{yearGroupLabel(p.yearGroup)}</td>
                <td className="p-4 text-slate-600">{p.formGroup?.name ?? "—"}</td>
                <td className="p-4">
                  {p.sendStatus !== "NONE" && (
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${SEND_STYLES[p.sendStatus]}`}>
                      {p.sendStatus === "SEND_SUPPORT" ? "SEND Support" : "EHCP"}
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {pupils?.length === 0 && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-sm text-slate-700">
                  No pupils found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
