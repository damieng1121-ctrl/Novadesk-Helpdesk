"use client";

import { useEffect, useState } from "react";

type FormGroup = { id: string; name: string; yearGroup: string };
type MealType = "SCHOOL_MEAL" | "PACKED_LUNCH" | "HOME" | "FSM";
type Row = { pupilId: string; firstName: string; lastName: string; mealType: MealType | null };

const MEAL_LABELS: Record<MealType, string> = {
  SCHOOL_MEAL: "School meal",
  PACKED_LUNCH: "Packed lunch",
  HOME: "Home",
  FSM: "Free school meal",
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function MealsPage() {
  const [formGroups, setFormGroups] = useState<FormGroup[] | null>(null);
  const [formGroupId, setFormGroupId] = useState("");
  const [date, setDate] = useState(today());
  const [rows, setRows] = useState<Row[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/form-groups")
      .then((r) => r.json())
      .then((groups) => {
        setFormGroups(groups);
        if (groups.length > 0) setFormGroupId((prev) => prev || groups[0].id);
      });
  }, []);

  function load() {
    if (!formGroupId || !date) return;
    fetch(`/api/meals?date=${date}&formGroupId=${formGroupId}`)
      .then((r) => r.json())
      .then(setRows);
  }

  useEffect(load, [formGroupId, date]);

  function setMealType(pupilId: string, mealType: MealType) {
    setRows((prev) => prev?.map((r) => (r.pupilId === pupilId ? { ...r, mealType } : r)) ?? prev);
  }

  async function save() {
    if (!rows) return;
    setSaving(true);
    try {
      const records = rows.filter((r) => r.mealType).map((r) => ({ pupilId: r.pupilId, mealType: r.mealType }));
      await fetch("/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, records }),
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  if (formGroups && formGroups.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Meal register</h1>
        <p className="mt-4 text-sm text-slate-700">Set up an academic year first.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Meal register</h1>
        <button
          onClick={save}
          disabled={saving || !rows || rows.length === 0}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <select
          value={formGroupId}
          onChange={(e) => {
            setFormGroupId(e.target.value);
            setSaved(false);
          }}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          {formGroups?.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setSaved(false);
          }}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        {saved && <span className="text-xs font-medium text-green-700">Saved.</span>}
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="p-4">Pupil</th>
              <th className="p-4">Meal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows?.map((r) => (
              <tr key={r.pupilId}>
                <td className="p-4 font-medium text-slate-900">
                  {r.firstName} {r.lastName}
                </td>
                <td className="p-4">
                  <select
                    value={r.mealType ?? ""}
                    onChange={(e) => setMealType(r.pupilId, e.target.value as MealType)}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                  >
                    <option value="">—</option>
                    {(Object.keys(MEAL_LABELS) as MealType[]).map((m) => (
                      <option key={m} value={m}>
                        {MEAL_LABELS[m]}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
            {rows?.length === 0 && (
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
