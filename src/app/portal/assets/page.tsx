"use client";

import { useEffect, useState } from "react";

type Asset = {
  id: string;
  tag: string;
  name: string;
  model: string | null;
  serialNumber: string | null;
  status: "ACTIVE" | "IN_REPAIR" | "RETIRED" | "LOST";
  warrantyExpiry: string | null;
  assignedTo: { name: string | null; email: string | null } | null;
};

const STATUS_STYLES: Record<Asset["status"], string> = {
  ACTIVE: "bg-green-100 text-green-700",
  IN_REPAIR: "bg-amber-100 text-amber-700",
  RETIRED: "bg-slate-100 text-slate-700",
  LOST: "bg-red-100 text-red-700",
};

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [tag, setTag] = useState("");
  const [name, setName] = useState("");
  const [model, setModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [warrantyExpiry, setWarrantyExpiry] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function load() {
    fetch("/api/assets")
      .then((r) => r.json())
      .then(setAssets);
  }
  useEffect(load, []);

  async function createAsset(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag, name, model: model || undefined, serialNumber: serialNumber || undefined, warrantyExpiry: warrantyExpiry || undefined }),
      });
      setTag("");
      setName("");
      setModel("");
      setSerialNumber("");
      setWarrantyExpiry("");
      setShowForm(false);
      load();
    } finally {
      setSubmitting(false);
    }
  }

  async function updateStatus(id: string, status: Asset["status"]) {
    await fetch(`/api/assets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  async function remove(id: string) {
    await fetch(`/api/assets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDeleted: true }),
    });
    load();
  }

  const filtered = assets?.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.tag.toLowerCase().includes(search.toLowerCase()) ||
      (a.serialNumber ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Assets inventory</h1>
        <button onClick={() => setShowForm(!showForm)} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          {showForm ? "Cancel" : "Add asset"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={createAsset} className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
          <input required value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Asset tag" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (e.g. Year 3 laptop 4)" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Model" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} placeholder="Serial number" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <div>
            <label className="block text-xs text-slate-700">Warranty expiry</label>
            <input type="date" value={warrantyExpiry} onChange={(e) => setWarrantyExpiry(e.target.value)} className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <button type="submit" disabled={submitting} className="sm:col-span-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {submitting ? "Saving…" : "Add asset"}
          </button>
        </form>
      )}

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name, tag, or serial…"
        className="mt-4 w-full max-w-md rounded-md border border-slate-300 px-3 py-2 text-sm"
      />

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="p-4">Tag / Name</th>
              <th className="p-4">Model / Serial</th>
              <th className="p-4">Warranty</th>
              <th className="p-4">Status</th>
              <th className="p-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered?.map((a) => (
              <tr key={a.id}>
                <td className="p-4">
                  <p className="font-medium text-slate-900">{a.name}</p>
                  <p className="text-xs text-slate-700">{a.tag}</p>
                </td>
                <td className="p-4 text-slate-600">
                  <p>{a.model ?? "—"}</p>
                  <p className="text-xs text-slate-600">{a.serialNumber ?? ""}</p>
                </td>
                <td className="p-4 text-slate-600">
                  {a.warrantyExpiry ? new Date(a.warrantyExpiry).toLocaleDateString("en-GB") : "—"}
                </td>
                <td className="p-4">
                  <select
                    value={a.status}
                    onChange={(e) => updateStatus(a.id, e.target.value as Asset["status"])}
                    className={`rounded-full border-0 px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[a.status]}`}
                  >
                    {(["ACTIVE", "IN_REPAIR", "RETIRED", "LOST"] as const).map((s) => (
                      <option key={s} value={s}>
                        {s.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-4">
                  <button onClick={() => remove(a.id)} className="text-xs text-red-600 hover:underline">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {filtered?.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-sm text-slate-700">
                  No assets found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
