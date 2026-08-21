"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type AcademicYear = { id: string; name: string; isCurrent: boolean };
type Pupil = { id: string; firstName: string; lastName: string };
type StaffMember = { id: string; name: string | null; email: string | null };
type Membership = {
  id: string;
  pupilId: string;
  status: "ACTIVE" | "WAITLIST";
  pupil: { firstName: string; lastName: string };
};
type Club = {
  id: string;
  name: string;
  description: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  capacity: number | null;
  staffLead: { name: string | null; email: string | null } | null;
  memberships: Membership[];
};

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function ClubsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user.role === "TENANT_ADMIN" || session?.user.role === "SUPER_ADMIN";

  const [clubs, setClubs] = useState<Club[] | null>(null);
  const [academicYears, setAcademicYears] = useState<AcademicYear[] | null>(null);
  const [pupils, setPupils] = useState<Pupil[] | null>(null);
  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addPupilId, setAddPupilId] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [academicYearId, setAcademicYearId] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState("1");
  const [startTime, setStartTime] = useState("15:15");
  const [endTime, setEndTime] = useState("16:15");
  const [capacity, setCapacity] = useState("");
  const [staffLeadId, setStaffLeadId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function load() {
    fetch("/api/clubs").then((r) => r.json()).then(setClubs);
  }

  useEffect(() => {
    load();
    fetch("/api/academic-years").then((r) => r.json()).then((years) => {
      setAcademicYears(years);
      const current = years.find((y: AcademicYear) => y.isCurrent);
      if (current) setAcademicYearId((prev) => prev || current.id);
    });
    fetch("/api/pupils").then((r) => r.json()).then(setPupils);
    if (isAdmin) fetch("/api/staff-profiles").then((r) => (r.ok ? r.json() : [])).then(setStaff);
  }, [isAdmin]);

  async function createClub(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetch("/api/clubs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || undefined,
          academicYearId,
          dayOfWeek: parseInt(dayOfWeek, 10),
          startTime,
          endTime,
          capacity: capacity ? parseInt(capacity, 10) : undefined,
          staffLeadId: staffLeadId || undefined,
        }),
      });
      setName("");
      setDescription("");
      setCapacity("");
      setStaffLeadId("");
      setShowForm(false);
      load();
    } finally {
      setSubmitting(false);
    }
  }

  async function addMember(clubId: string) {
    if (!addPupilId) return;
    await fetch(`/api/clubs/${clubId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pupilId: addPupilId }),
    });
    setAddPupilId("");
    load();
  }

  async function removeMember(clubId: string, pupilId: string) {
    await fetch(`/api/clubs/${clubId}/members?pupilId=${pupilId}`, { method: "DELETE" });
    load();
  }

  async function deleteClub(id: string) {
    await fetch(`/api/clubs/${id}`, { method: "DELETE" });
    load();
  }

  if (academicYears && academicYears.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Clubs</h1>
        <p className="mt-4 text-sm text-slate-700">Set up an academic year first.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Clubs</h1>
        {isAdmin && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            {showForm ? "Cancel" : "New club"}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={createClub} className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-3">
          <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Club name" className="sm:col-span-2 rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <select required value={academicYearId} onChange={(e) => setAcademicYearId(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">Academic year…</option>
            {academicYears?.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
          </select>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className="sm:col-span-3 rounded-md border border-slate-300 px-3 py-2 text-sm"
            rows={2}
          />
          <select value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            {DAYS.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
          <input required type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input required type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input type="number" min="1" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="Capacity (optional)" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <select value={staffLeadId} onChange={(e) => setStaffLeadId(e.target.value)} className="sm:col-span-2 rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">Staff lead (optional)</option>
            {staff?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name ?? s.email}
              </option>
            ))}
          </select>
          <button type="submit" disabled={submitting} className="sm:col-span-3 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
            {submitting ? "Saving…" : "Create club"}
          </button>
        </form>
      )}

      <div className="mt-4 space-y-3">
        {clubs?.map((c) => {
          const activeCount = c.memberships.filter((m) => m.status === "ACTIVE").length;
          const waitlist = c.memberships.filter((m) => m.status === "WAITLIST");
          const active = c.memberships.filter((m) => m.status === "ACTIVE");
          const isExpanded = expandedId === c.id;
          return (
            <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">{c.name}</p>
                  <p className="text-xs text-slate-600">
                    {DAYS[c.dayOfWeek]} · {c.startTime}–{c.endTime}
                    {c.staffLead && ` · ${c.staffLead.name ?? c.staffLead.email}`}
                  </p>
                  {c.description && <p className="mt-1 text-xs text-slate-700">{c.description}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-slate-600">
                    {activeCount}
                    {c.capacity ? ` / ${c.capacity}` : ""} members
                    {waitlist.length > 0 ? ` · ${waitlist.length} waitlisted` : ""}
                  </span>
                  <button onClick={() => setExpandedId(isExpanded ? null : c.id)} className="text-xs font-medium text-indigo-600 hover:underline">
                    {isExpanded ? "Hide" : "Manage"}
                  </button>
                  {isAdmin && (
                    <button onClick={() => deleteClub(c.id)} className="text-xs text-red-600 hover:underline">
                      Delete
                    </button>
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <div className="flex gap-2">
                    <select value={addPupilId} onChange={(e) => setAddPupilId(e.target.value)} className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm">
                      <option value="">Add pupil…</option>
                      {pupils?.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.firstName} {p.lastName}
                        </option>
                      ))}
                    </select>
                    <button onClick={() => addMember(c.id)} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                      Add
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Active</h3>
                      <ul className="mt-2 space-y-1">
                        {active.map((m) => (
                          <li key={m.id} className="flex items-center justify-between text-sm">
                            <span>
                              {m.pupil.firstName} {m.pupil.lastName}
                            </span>
                            <button onClick={() => removeMember(c.id, m.pupilId)} className="text-xs text-red-600 hover:underline">
                              Remove
                            </button>
                          </li>
                        ))}
                        {active.length === 0 && <li className="text-xs text-slate-500">No members yet.</li>}
                      </ul>
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Waitlist</h3>
                      <ul className="mt-2 space-y-1">
                        {waitlist.map((m) => (
                          <li key={m.id} className="flex items-center justify-between text-sm">
                            <span>
                              {m.pupil.firstName} {m.pupil.lastName}
                            </span>
                            <button onClick={() => removeMember(c.id, m.pupilId)} className="text-xs text-red-600 hover:underline">
                              Remove
                            </button>
                          </li>
                        ))}
                        {waitlist.length === 0 && <li className="text-xs text-slate-500">Nobody waiting.</li>}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {clubs?.length === 0 && <p className="text-sm text-slate-700">No clubs set up yet.</p>}
      </div>
    </div>
  );
}
