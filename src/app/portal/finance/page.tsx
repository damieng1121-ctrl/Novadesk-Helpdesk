"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type Record_ = {
  id: string;
  poNumber: string;
  description: string;
  amountPence: number;
  vendor: string;
  status: "PENDING" | "APPROVED" | "ORDERED" | "DELIVERED";
  requestDate: string;
  requestedBy: { name: string | null; email: string | null };
};

const STATUS_STYLES: Record<Record_["status"], string> = {
  PENDING: "bg-slate-100 text-slate-600",
  APPROVED: "bg-blue-100 text-blue-700",
  ORDERED: "bg-amber-100 text-amber-700",
  DELIVERED: "bg-green-100 text-green-700",
};

function formatGbp(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

export default function FinancePage() {
  const { data: session } = useSession();
  const isAdmin = session?.user.role === "TENANT_ADMIN" || session?.user.role === "SUPER_ADMIN";

  const [records, setRecords] = useState<Record_[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [poNumber, setPoNumber] = useState("");
  const [description, setDescription] = useState("");
  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function load() {
    fetch("/api/finance")
      .then((r) => r.json())
      .then(setRecords);
  }
  useEffect(load, []);

  async function createRecord(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const amountPence = Math.round(parseFloat(amount || "0") * 100);
      await fetch("/api/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ poNumber, description, vendor, amountPence }),
      });
      setPoNumber("");
      setDescription("");
      setVendor("");
      setAmount("");
      setShowForm(false);
      load();
    } finally {
      setSubmitting(false);
    }
  }

  async function updateStatus(id: string, status: Record_["status"]) {
    await fetch(`/api/finance/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  async function remove(id: string) {
    await fetch(`/api/finance/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDeleted: true }),
    });
    load();
  }

  const total = records?.reduce((sum, r) => sum + r.amountPence, 0) ?? 0;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Finance &amp; procurement</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          {showForm ? "Cancel" : "New request"}
        </button>
      </div>
      <p className="mt-1 text-sm text-slate-500">{records ? `${records.length} records · ${formatGbp(total)} total` : ""}</p>

      {showForm && (
        <form onSubmit={createRecord} className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
          <input required value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="PO number" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input required value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Vendor" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input required type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount (£)" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input required value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's this for?" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <button type="submit" disabled={submitting} className="sm:col-span-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {submitting ? "Submitting…" : "Submit request"}
          </button>
        </form>
      )}

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="p-4">PO / Description</th>
              <th className="p-4">Vendor</th>
              <th className="p-4">Amount</th>
              <th className="p-4">Requested by</th>
              <th className="p-4">Status</th>
              {isAdmin && <th className="p-4"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {records?.map((r) => (
              <tr key={r.id}>
                <td className="p-4">
                  <p className="font-medium text-slate-900">{r.poNumber}</p>
                  <p className="text-xs text-slate-500">{r.description}</p>
                </td>
                <td className="p-4 text-slate-600">{r.vendor}</td>
                <td className="p-4 text-slate-600">{formatGbp(r.amountPence)}</td>
                <td className="p-4 text-slate-600">{r.requestedBy.name ?? r.requestedBy.email}</td>
                <td className="p-4">
                  {isAdmin ? (
                    <select
                      value={r.status}
                      onChange={(e) => updateStatus(r.id, e.target.value as Record_["status"])}
                      className={`rounded-full border-0 px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[r.status]}`}
                    >
                      {(["PENDING", "APPROVED", "ORDERED", "DELIVERED"] as const).map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[r.status]}`}>{r.status}</span>
                  )}
                </td>
                {isAdmin && (
                  <td className="p-4">
                    <button onClick={() => remove(r.id)} className="text-xs text-red-600 hover:underline">
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {records?.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 6 : 5} className="p-6 text-center text-sm text-slate-500">
                  No procurement requests yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
