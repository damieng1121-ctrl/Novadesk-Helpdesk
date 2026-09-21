"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { SlideOver } from "@/components/slide-over";

type Staff = { id: string; name: string | null; email: string | null };
type Brand = { id: string; name: string; supportEmail: string | null; technicians: Staff[] };

export default function BrandsAdminPage() {
  const [brands, setBrands] = useState<Brand[] | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    fetch("/api/brands")
      .then((r) => r.json())
      .then(setBrands);
  }
  useEffect(() => {
    load();
    fetch("/api/staff")
      .then((r) => r.json())
      .then(setStaff);
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, supportEmail: supportEmail || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      setName("");
      setSupportEmail("");
      setOpen(false);
      load();
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this brand? Tickets already tagged with it just lose the tag.")) return;
    await fetch(`/api/brands/${id}`, { method: "DELETE" });
    load();
  }

  async function toggleTechnician(brand: Brand, staffId: string) {
    const has = brand.technicians.some((t) => t.id === staffId);
    const technicianIds = has
      ? brand.technicians.filter((t) => t.id !== staffId).map((t) => t.id)
      : [...brand.technicians.map((t) => t.id), staffId];
    await fetch(`/api/brands/${brand.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ technicianIds }),
    });
    load();
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Brands</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            For running more than one business through this helpdesk (e.g. Education Lincs and Schools Online).
            Assign a Technician to a Brand and their ticket queue is scoped to just that Brand&apos;s tickets — leave
            a Technician unassigned to any Brand and they keep seeing everything, as today. Admins always see
            everything.
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <Plus size={16} />
          Add brand
        </button>
      </div>

      <div className="mt-6 space-y-4">
        {brands?.map((b) => (
          <div key={b.id} className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-100">{b.name}</p>
                {b.supportEmail && <p className="text-xs text-slate-600 dark:text-slate-400">{b.supportEmail}</p>}
              </div>
              <button onClick={() => remove(b.id)} className="text-xs text-red-600 hover:underline">
                Delete
              </button>
            </div>
            <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-600 dark:text-slate-400">Technicians</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {staff.length === 0 && <p className="text-sm text-slate-600 dark:text-slate-400">No technicians invited yet.</p>}
              {staff.map((s) => {
                const active = b.technicians.some((t) => t.id === s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => toggleTechnician(b, s.id)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${
                      active
                        ? "border-indigo-600 bg-indigo-600 text-white"
                        : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {s.name ?? s.email}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {brands?.length === 0 && (
          <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            No brands yet — until you add one, every ticket is visible to every technician, same as today.
          </p>
        )}
      </div>

      <SlideOver open={open} onClose={() => setOpen(false)} title="Add a brand" description="A separate business/trading name run through this same helpdesk.">
        <form onSubmit={create} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Brand name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Schools Online"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Support email (optional)</label>
            <input
              type="email"
              value={supportEmail}
              onChange={(e) => setSupportEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Add brand"}
          </button>
        </form>
      </SlideOver>
    </div>
  );
}
