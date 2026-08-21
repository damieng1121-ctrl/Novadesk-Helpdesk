"use client";

import { useEffect, useState } from "react";

type FormGroup = { id: string; name: string; yearGroup: string };
type Teacher = { id: string; name: string | null; email: string | null };

type EventSummary = {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  slotMinutes: number;
  formGroupIds: string[];
  bookingOpensAt: string | null;
  bookingClosesAt: string | null;
  locationNote: string | null;
  _count: { slots: number };
};

type Slot = {
  id: string;
  teacherId: string;
  startTime: string;
  endTime: string;
  status: "AVAILABLE" | "BOOKED" | "CANCELLED";
  teacher: { id: string; name: string | null; email: string | null };
  pupil: { id: string; firstName: string; lastName: string } | null;
  guardian: { id: string; name: string | null; email: string | null } | null;
};

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function ParentsEveningsClient({ formGroups, teachers }: { formGroups: FormGroup[]; teachers: Teacher[] }) {
  const [events, setEvents] = useState<EventSummary[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("16:00");
  const [endTime, setEndTime] = useState("18:00");
  const [slotMinutes, setSlotMinutes] = useState(10);
  const [selectedFormGroups, setSelectedFormGroups] = useState<string[]>([]);
  const [locationNote, setLocationNote] = useState("");

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  function load() {
    fetch("/api/parents-evenings")
      .then((r) => r.json())
      .then(setEvents);
  }
  useEffect(load, []);

  async function createEvent(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetch("/api/parents-evenings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          date,
          startTime,
          endTime,
          slotMinutes,
          formGroupIds: selectedFormGroups,
          locationNote: locationNote || undefined,
        }),
      });
      setTitle("");
      setDate("");
      setSelectedFormGroups([]);
      setLocationNote("");
      setShowForm(false);
      load();
    } finally {
      setSubmitting(false);
    }
  }

  function toggleFormGroup(id: string) {
    setSelectedFormGroups((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Parents&apos; evenings</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          {showForm ? "Cancel" : "New event"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={createEvent} className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
          <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="rounded-md border border-slate-300 px-3 py-2 text-sm sm:col-span-2" />
          <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input
            type="number"
            min={1}
            max={120}
            value={slotMinutes}
            onChange={(e) => setSlotMinutes(Number(e.target.value))}
            placeholder="Slot length (minutes)"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <label className="flex flex-col gap-1 text-xs text-slate-600">
            Start time
            <input required type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-600">
            End time
            <input required type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <input value={locationNote} onChange={(e) => setLocationNote(e.target.value)} placeholder="Location note (optional)" className="rounded-md border border-slate-300 px-3 py-2 text-sm sm:col-span-2" />

          <div className="sm:col-span-2">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-600">Form groups</p>
            <div className="flex flex-wrap gap-3">
              {formGroups.map((fg) => (
                <label key={fg.id} className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={selectedFormGroups.includes(fg.id)} onChange={() => toggleFormGroup(fg.id)} />
                  {fg.name}
                </label>
              ))}
              {formGroups.length === 0 && <p className="text-sm text-slate-600">No form groups set up yet.</p>}
            </div>
          </div>

          <button type="submit" disabled={submitting} className="sm:col-span-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
            {submitting ? "Creating…" : "Create event"}
          </button>
        </form>
      )}

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="p-4">Title</th>
              <th className="p-4">Date</th>
              <th className="p-4">Window</th>
              <th className="p-4">Slots</th>
              <th className="p-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {events?.map((ev) => (
              <tr key={ev.id}>
                <td className="p-4 font-medium text-slate-900">{ev.title}</td>
                <td className="p-4 text-slate-600">{new Date(ev.date).toLocaleDateString("en-GB")}</td>
                <td className="p-4 text-slate-600">{ev.startTime}–{ev.endTime}</td>
                <td className="p-4 text-slate-600">{ev._count.slots}</td>
                <td className="p-4">
                  <button onClick={() => setSelectedEventId(ev.id)} className="text-xs font-medium text-indigo-600 hover:underline">
                    View slots
                  </button>
                </td>
              </tr>
            ))}
            {events?.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-sm text-slate-700">No events yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedEventId && (
        <EventDetail eventId={selectedEventId} teachers={teachers} onClose={() => setSelectedEventId(null)} onSlotsChanged={load} />
      )}
    </div>
  );
}

function EventDetail({
  eventId,
  teachers,
  onClose,
  onSlotsChanged,
}: {
  eventId: string;
  teachers: Teacher[];
  onClose: () => void;
  onSlotsChanged: () => void;
}) {
  const [event, setEvent] = useState<EventSummary | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [teacherId, setTeacherId] = useState(teachers[0]?.id ?? "");
  const [rangeStart, setRangeStart] = useState("16:00");
  const [rangeEnd, setRangeEnd] = useState("18:00");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch(`/api/parents-evenings/${eventId}`)
      .then((r) => r.json())
      .then((data) => {
        setEvent(data.event);
        setSlots(data.slots);
      });
  }
  useEffect(load, [eventId]);

  async function generateSlots(e: React.FormEvent) {
    e.preventDefault();
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/parents-evenings/${eventId}/slots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherId, startTime: rangeStart, endTime: rangeEnd }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      load();
      onSlotsChanged();
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">{event?.title ?? "Loading…"}</h2>
        <button onClick={onClose} className="text-sm text-slate-600 hover:underline">Close</button>
      </div>

      <form onSubmit={generateSlots} className="mt-4 grid grid-cols-1 gap-3 rounded-lg bg-slate-50 p-4 sm:grid-cols-4">
        <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>{t.name ?? t.email}</option>
          ))}
        </select>
        <input type="time" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <input type="time" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <button type="submit" disabled={generating || !teacherId} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
          {generating ? "Generating…" : "Generate slots"}
        </button>
        {error && <p className="text-sm text-red-600 sm:col-span-4">{error}</p>}
      </form>

      <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="p-3">Teacher</th>
              <th className="p-3">Time</th>
              <th className="p-3">Status</th>
              <th className="p-3">Booked for</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {slots?.map((s) => (
              <tr key={s.id}>
                <td className="p-3 text-slate-700">{s.teacher.name ?? s.teacher.email}</td>
                <td className="p-3 text-slate-600">{fmtTime(s.startTime)}–{fmtTime(s.endTime)}</td>
                <td className="p-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${s.status === "AVAILABLE" ? "bg-green-100 text-green-700" : s.status === "BOOKED" ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600"}`}>
                    {s.status}
                  </span>
                </td>
                <td className="p-3 text-slate-600">
                  {s.pupil ? `${s.pupil.firstName} ${s.pupil.lastName}${s.guardian ? ` (${s.guardian.name ?? s.guardian.email})` : ""}` : "—"}
                </td>
              </tr>
            ))}
            {slots?.length === 0 && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-sm text-slate-700">No slots yet — generate some above.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
