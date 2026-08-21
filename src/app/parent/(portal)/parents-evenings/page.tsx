"use client";

import { useEffect, useState } from "react";

type Child = { id: string; name: string; formGroupId: string | null };
type Slot = {
  id: string;
  startTime: string;
  endTime: string;
  status: "AVAILABLE" | "BOOKED" | "CANCELLED";
  teacher: { id: string; name: string | null; email: string | null };
  pupil: { id: string; firstName: string; lastName: string } | null;
};
type EventData = {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  locationNote: string | null;
  slots: Slot[];
};

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export default function ParentParentsEveningsPage() {
  const [children, setChildren] = useState<Child[]>([]);
  const [events, setEvents] = useState<EventData[] | null>(null);
  const [selectedPupilId, setSelectedPupilId] = useState<Record<string, string>>({});
  const [booking, setBooking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch("/api/parent/parents-evenings")
      .then((r) => r.json())
      .then((data) => {
        setChildren(data.children);
        setEvents(data.events);
      });
  }
  useEffect(load, []);

  async function book(slotId: string) {
    const pupilId = selectedPupilId[slotId];
    if (!pupilId) {
      setError("Choose which child this appointment is for first.");
      return;
    }
    setBooking(slotId);
    setError(null);
    try {
      const res = await fetch("/api/parent/parents-evenings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotId, pupilId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      load();
    } finally {
      setBooking(null);
    }
  }

  async function cancel(slotId: string) {
    if (!confirm("Cancel this appointment?")) return;
    setBooking(slotId);
    try {
      await fetch(`/api/parent/parents-evenings?slotId=${slotId}`, { method: "DELETE" });
      load();
    } finally {
      setBooking(null);
    }
  }

  const myBookings = (events ?? []).flatMap((ev) =>
    ev.slots.filter((s) => s.status === "BOOKED").map((s) => ({ event: ev, slot: s })),
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Parents&apos; evenings</h1>
      {error && <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {myBookings.length > 0 && (
        <div className="mt-4">
          <h2 className="text-lg font-semibold text-slate-900">Your bookings</h2>
          <div className="mt-2 space-y-2">
            {myBookings.map(({ event, slot }) => (
              <div key={slot.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {event.title} — {slot.pupil?.firstName} {slot.pupil?.lastName}
                  </p>
                  <p className="text-sm text-slate-600">
                    {new Date(event.date).toLocaleDateString("en-GB")}, {fmtTime(slot.startTime)}–{fmtTime(slot.endTime)} with {slot.teacher.name ?? slot.teacher.email}
                  </p>
                </div>
                <button onClick={() => cancel(slot.id)} disabled={booking === slot.id} className="text-xs text-red-600 hover:underline disabled:opacity-50">
                  Cancel
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <h2 className="mt-6 text-lg font-semibold text-slate-900">Available appointments</h2>
      {events?.length === 0 && <p className="mt-2 text-sm text-slate-600">No open booking windows right now.</p>}
      <div className="mt-3 space-y-6">
        {events?.map((ev) => {
          const available = ev.slots.filter((s) => s.status === "AVAILABLE");
          return (
            <div key={ev.id} className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="font-medium text-slate-900">{ev.title}</p>
              <p className="text-sm text-slate-600">
                {new Date(ev.date).toLocaleDateString("en-GB")}, {ev.startTime}–{ev.endTime}
                {ev.locationNote ? ` · ${ev.locationNote}` : ""}
              </p>

              {available.length === 0 ? (
                <p className="mt-2 text-sm text-slate-600">No available slots left.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {available.map((s) => (
                    <div key={s.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
                      <p className="text-sm text-slate-700">
                        {fmtTime(s.startTime)}–{fmtTime(s.endTime)} with {s.teacher.name ?? s.teacher.email}
                      </p>
                      <div className="flex items-center gap-2">
                        <select
                          value={selectedPupilId[s.id] ?? ""}
                          onChange={(e) => setSelectedPupilId((cur) => ({ ...cur, [s.id]: e.target.value }))}
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                        >
                          <option value="" disabled>Child…</option>
                          {children.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => book(s.id)}
                          disabled={booking === s.id}
                          className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                          Book
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
