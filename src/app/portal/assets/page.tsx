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
  company: { id: string; name: string } | null;
};

type Company = { id: string; name: string };

type ImportRowResult = { row: number; tag: string | null; action: "created" | "updated" | "skipped"; warnings: string[] };
type ImportResult = {
  created: number;
  updated: number;
  skipped: number;
  rows: ImportRowResult[];
  truncated: boolean;
};

const STATUS_STYLES: Record<Asset["status"], string> = {
  ACTIVE: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  IN_REPAIR: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  RETIRED: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  LOST: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyFilter, setCompanyFilter] = useState("");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [tag, setTag] = useState("");
  const [name, setName] = useState("");
  const [model, setModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [warrantyExpiry, setWarrantyExpiry] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  function load() {
    const qs = companyFilter ? `?companyId=${companyFilter}` : "";
    fetch(`/api/assets${qs}`)
      .then((r) => r.json())
      .then(setAssets);
  }
  useEffect(load, [companyFilter]);
  useEffect(() => {
    fetch("/api/admin/companies")
      .then((r) => (r.ok ? r.json() : []))
      .then(setCompanies);
  }, []);

  async function createAsset(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tag,
          name,
          model: model || undefined,
          serialNumber: serialNumber || undefined,
          warrantyExpiry: warrantyExpiry || undefined,
          companyId: companyId || undefined,
        }),
      });
      setTag("");
      setName("");
      setModel("");
      setSerialNumber("");
      setWarrantyExpiry("");
      setCompanyId("");
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

  async function updateCompany(id: string, newCompanyId: string) {
    await fetch(`/api/assets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId: newCompanyId || null }),
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

  async function runImport(e: React.FormEvent) {
    e.preventDefault();
    if (!importFile) return;
    setImporting(true);
    setImportError(null);
    setImportResult(null);
    try {
      const form = new FormData();
      form.set("file", importFile);
      const res = await fetch("/api/assets/import", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setImportError(data.error ?? "Import failed");
        return;
      }
      setImportResult(data);
      setImportFile(null);
      load();
    } finally {
      setImporting(false);
    }
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
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Assets inventory</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setShowImport(!showImport);
              setShowForm(false);
            }}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {showImport ? "Cancel" : "Import spreadsheet"}
          </button>
          <button
            onClick={() => {
              setShowForm(!showForm);
              setShowImport(false);
            }}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            {showForm ? "Cancel" : "Add asset"}
          </button>
        </div>
      </div>

      {showImport && (
        <form onSubmit={runImport} className="mt-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-700 dark:text-slate-300">
            Upload a .xlsx or .csv file with a header row. Recognised columns: <strong>Tag</strong> and{" "}
            <strong>Name</strong> (required), Model, Serial Number, Company, Assigned To (email), Status, Purchase
            Date, Warranty Expiry — column names are matched case-insensitively and don&apos;t need to be exact.
            Re-uploading updates existing assets that share the same tag rather than duplicating them.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
              className="text-sm text-slate-600 file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-50 dark:text-slate-400 dark:file:border-slate-700 dark:file:bg-slate-900 dark:file:text-slate-300 hover:file:dark:bg-slate-800"
            />
            <button
              type="submit"
              disabled={!importFile || importing}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {importing ? "Importing…" : "Upload"}
            </button>
          </div>
          {importError && <p className="mt-3 text-sm text-red-600">{importError}</p>}
          {importResult && (
            <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-800/50">
              <p className="font-medium text-slate-900 dark:text-slate-100">
                {importResult.created} created · {importResult.updated} updated · {importResult.skipped} skipped
              </p>
              {importResult.rows.some((r) => r.warnings.length > 0) && (
                <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs text-slate-700 dark:text-slate-300">
                  {importResult.rows
                    .filter((r) => r.warnings.length > 0)
                    .map((r) => (
                      <li key={r.row}>
                        Row {r.row} ({r.tag ?? "no tag"}): {r.warnings.join("; ")}
                      </li>
                    ))}
                </ul>
              )}
              {importResult.truncated && (
                <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                  (showing the first rows only — the sheet had more)
                </p>
              )}
            </div>
          )}
        </form>
      )}

      {showForm && (
        <form onSubmit={createAsset} className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2 dark:border-slate-800 dark:bg-slate-900">
          <input required value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Asset tag" className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" />
          <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (e.g. Year 3 laptop 4)" className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" />
          <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Model" className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" />
          <input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} placeholder="Serial number" className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" />
          <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
            <option value="">Which school/company owns this? (optional)</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <div>
            <label className="block text-xs text-slate-700 dark:text-slate-300">Warranty expiry</label>
            <input type="date" value={warrantyExpiry} onChange={(e) => setWarrantyExpiry(e.target.value)} className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" />
          </div>
          <button type="submit" disabled={submitting} className="sm:col-span-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
            {submitting ? "Saving…" : "Add asset"}
          </button>
        </form>
      )}

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name, tag, or serial…"
        className="mt-4 w-full max-w-md rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
      />
      {companies.length > 1 && (
        <select
          value={companyFilter}
          onChange={(e) => setCompanyFilter(e.target.value)}
          className="ml-2 rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-400"
        >
          <option value="">All companies</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-600 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th className="p-4">Tag / Name</th>
              <th className="p-4">Model / Serial</th>
              <th className="p-4">Company</th>
              <th className="p-4">Warranty</th>
              <th className="p-4">Status</th>
              <th className="p-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered?.map((a) => (
              <tr key={a.id}>
                <td className="p-4">
                  <p className="font-medium text-slate-900 dark:text-slate-100">{a.name}</p>
                  <p className="text-xs text-slate-700 dark:text-slate-300">{a.tag}</p>
                </td>
                <td className="p-4 text-slate-600 dark:text-slate-400">
                  <p>{a.model ?? "—"}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">{a.serialNumber ?? ""}</p>
                </td>
                <td className="p-4">
                  <select
                    value={a.company?.id ?? ""}
                    onChange={(e) => updateCompany(a.id, e.target.value)}
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
                <td className="p-4 text-slate-600 dark:text-slate-400">
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
                <td colSpan={6} className="p-6 text-center text-sm text-slate-700 dark:text-slate-300">
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
