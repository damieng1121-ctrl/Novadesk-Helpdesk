"use client";

import { useEffect, useState } from "react";

type Tenant = {
  id: string;
  name: string;
  slug: string;
  domain: string;
  phase: string;
  urn: string | null;
  isActive: boolean;
  createdAt: string;
  _count: { users: number; tickets: number };
};

const PHASES = ["NURSERY", "PRIMARY", "SECONDARY", "ALL_THROUGH", "SPECIAL", "MULTI_ACADEMY_TRUST"];

export default function SuperAdminPage() {
  const [tenants, setTenants] = useState<Tenant[] | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [domain, setDomain] = useState("");
  const [phase, setPhase] = useState("PRIMARY");
  const [urn, setUrn] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    fetch("/api/super-admin/tenants")
      .then((r) => r.json())
      .then(setTenants);
  }
  useEffect(load, []);

  async function createTenant(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/super-admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug, domain, phase, urn: urn || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      setName("");
      setSlug("");
      setDomain("");
      setUrn("");
      load();
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(id: string, isActive: boolean) {
    await fetch(`/api/super-admin/tenants/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    load();
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Schools</h1>
      <p className="mt-1 text-sm text-slate-600">
        Onboard a new school by registering its Google Workspace domain — the first person
        who signs in from that domain is auto-provisioned as a Requester.
      </p>

      <form onSubmit={createTenant} className="mt-6 grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-6 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-700">School name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Willowbrook Primary School"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">URL slug</label>
          <input
            required
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            placeholder="willowbrook"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Google Workspace domain</label>
          <input
            required
            value={domain}
            onChange={(e) => setDomain(e.target.value.toLowerCase())}
            placeholder="willowbrook-primary.sch.uk"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Phase</label>
          <select
            value={phase}
            onChange={(e) => setPhase(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            {PHASES.map((p) => (
              <option key={p} value={p}>
                {p.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">DfE URN (optional)</label>
          <input
            value={urn}
            onChange={(e) => setUrn(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Creating…" : "Add school"}
          </button>
        </div>
        {error && <p className="sm:col-span-2 text-sm text-red-600">{error}</p>}
      </form>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="p-4">School</th>
              <th className="p-4">Domain</th>
              <th className="p-4">Users</th>
              <th className="p-4">Tickets</th>
              <th className="p-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tenants?.map((t) => (
              <tr key={t.id}>
                <td className="p-4">
                  <p className="font-medium text-slate-900">{t.name}</p>
                  <p className="text-xs text-slate-500">/{t.slug} · {t.phase.replace(/_/g, " ")}</p>
                </td>
                <td className="p-4 text-slate-600">{t.domain}</td>
                <td className="p-4 text-slate-600">{t._count.users}</td>
                <td className="p-4 text-slate-600">{t._count.tickets}</td>
                <td className="p-4">
                  <button
                    onClick={() => toggleActive(t.id, t.isActive)}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      t.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {t.isActive ? "Active" : "Suspended"}
                  </button>
                </td>
              </tr>
            ))}
            {tenants?.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-sm text-slate-500">
                  No schools yet — add one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
