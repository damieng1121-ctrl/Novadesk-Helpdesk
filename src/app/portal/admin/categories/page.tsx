"use client";

import { useEffect, useState } from "react";

type Category = { id: string; name: string; description: string | null; color: string };

export default function CategoriesAdminPage() {
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#64748b");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    fetch("/api/categories")
      .then((r) => r.json())
      .then(setCategories);
  }
  useEffect(load, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: description || undefined, color }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      setName("");
      setDescription("");
      setColor("#64748b");
      load();
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this category? Tickets already using it will just become uncategorised.")) return;
    await fetch(`/api/categories/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-slate-900">Categories</h1>
      <p className="mt-1 text-sm text-slate-600">
        Ticket categories used for triage, filtering, and reporting — shown to Users when they raise a ticket.
      </p>

      <form onSubmit={create} className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-white p-5">
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name, e.g. Printers"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-10 w-14 rounded-md border border-slate-300"
          />
        </div>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Add category"}
        </button>
      </form>

      <div className="mt-6 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
        {categories?.map((c) => (
          <div key={c.id} className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
              <div>
                <p className="font-medium text-slate-900">{c.name}</p>
                {c.description && <p className="text-xs text-slate-600">{c.description}</p>}
              </div>
            </div>
            <button onClick={() => remove(c.id)} className="text-xs text-red-600 hover:underline">
              Delete
            </button>
          </div>
        ))}
        {categories?.length === 0 && <p className="p-6 text-sm text-slate-700">No categories yet.</p>}
      </div>
    </div>
  );
}
