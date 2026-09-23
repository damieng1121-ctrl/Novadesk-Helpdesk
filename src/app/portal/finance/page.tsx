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
  company: { id: string; name: string } | null;
};

type Company = { id: string; name: string };

const STATUS_STYLES: Record<Record_["status"], string> = {
  PENDING: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  APPROVED: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  ORDERED: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  DELIVERED: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
};

function formatGbp(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

export default function FinancePage() {
  const { data: session } = useSession();
  const isAdmin = session?.user.role === "TENANT_ADMIN" || session?.user.role === "SUPER_ADMIN";
  const staff = isAdmin || session?.user.role === "AGENT";

  const [records, setRecords] = useState<Record_[] | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyFilter, setCompanyFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [poNumber, setPoNumber] = useState("");
  const [description, setDescription] = useState("");
  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function load() {
    const qs = companyFilter ? `?companyId=${companyFilter}` : "";
    fetch(`/api/finance${qs}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setRecords);
  }
  useEffect(load, [companyFilter]);

  // Company names are staff-only information — see the matching comment in
  // src/app/portal/tickets/page.tsx.
  useEffect(() => {
    if (!staff) return;
    fetch("/api/admin/companies")
      .then((r) => (r.ok ? r.json() : []))
      .then(setCompanies);
  }, [staff]);

  async function createRecord(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const amountPence = Math.round(parseFloat(amount || "0") * 100);
      await fetch("/api/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ poNumber, description, vendor, amountPence, companyId: companyId || undefined }),
      });
      setPoNumber("");
      setDescription("");
      setVendor("");
      setAmount("");
      setCompanyId("");
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

  async function updateCompany(id: string, newCompanyId: string) {
    await fetch(`/api/finance/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId: newCompanyId || null }),
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
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Finance &amp; procurement</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          {showForm ? "Cancel" : "New request"}
        </button>
      </div>
      <div className="mt-1 flex items-center justify-between">
        <p className="text-sm text-slate-700 dark:text-slate-300">{records ? `${records.length} records · ${formatGbp(total)} total` : ""}</p>
        {companies.length > 1 && (
          <select
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-400"
          >
            <option value="">All companies</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {showForm && (
        <form onSubmit={createRecord} className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2 dark:border-slate-800 dark:bg-slate-900">
          <input required value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="PO number" className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" />
          <input required value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Vendor" className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" />
          <input required type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount (£)" className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" />
          <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
            <option value="">Which school/company is this for? (optional)</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input required value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's this for?" className="sm:col-span-2 rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" />
          <button type="submit" disabled={submitting} className="sm:col-span-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
            {submitting ? "Submitting…" : "Submit request"}
          </button>
        </form>
      )}

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-600 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th className="p-4">PO / Description</th>
              <th className="p-4">Vendor</th>
              <th className="p-4">Amount</th>
              <th className="p-4">Company</th>
              <th className="p-4">Requested by</th>
              <th className="p-4">Status</th>
              {isAdmin && <th className="p-4"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {records?.map((r) => (
              <tr key={r.id}>
                <td className="p-4">
                  <p className="font-medium text-slate-900 dark:text-slate-100">{r.poNumber}</p>
                  <p className="text-xs text-slate-700 dark:text-slate-300">{r.description}</p>
                </td>
                <td className="p-4 text-slate-600 dark:text-slate-400">{r.vendor}</td>
                <td className="p-4 text-slate-600 dark:text-slate-400">{formatGbp(r.amountPence)}</td>
                <td className="p-4">
                  <select
                    value={r.company?.id ?? ""}
                    onChange={(e) => updateCompany(r.id, e.target.value)}
                    className="rounded-md border border-slate-200 bg-transparent px-2 py-1 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-400"
                  >
                    <option value="">None</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-4 text-slate-600 dark:text-slate-400">{r.requestedBy.name ?? r.requestedBy.email}</td>
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
                <td colSpan={isAdmin ? 7 : 6} className="p-6 text-center text-sm text-slate-700 dark:text-slate-300">
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
