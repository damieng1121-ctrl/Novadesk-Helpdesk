"use client";

import { useEffect, useState } from "react";

type Role = "SUPER_ADMIN" | "TENANT_ADMIN" | "AGENT" | "REQUESTER";

const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Admin",
  TENANT_ADMIN: "Admin",
  AGENT: "Technician",
  REQUESTER: "User",
};

type User = {
  id: string;
  name: string | null;
  email: string | null;
  role: Role;
  isActive: boolean;
  twoFactorEnabled: boolean;
  companyId: string | null;
  company: { id: string; name: string } | null;
  _count: { accounts: number };
};

type Company = {
  id: string;
  name: string;
  domain: string | null;
  urn: string | null;
  phase: string | null;
  _count: { users: number };
};

function describeApiError(data: { error?: string; issues?: { path: (string | number)[]; message: string }[] }): string {
  if (data.issues?.length) {
    return data.issues.map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message)).join("; ");
  }
  return data.error ?? "Something went wrong";
}

export default function UsersAdminPage() {
  const [tab, setTab] = useState<"users" | "companies">("users");

  const [users, setUsers] = useState<User[] | null>(null);
  const [companies, setCompanies] = useState<Company[] | null>(null);

  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"REQUESTER" | "AGENT" | "TENANT_ADMIN">("REQUESTER");
  const [companyId, setCompanyId] = useState("");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showAddCompany, setShowAddCompany] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [addingCompany, setAddingCompany] = useState(false);
  const [companyError, setCompanyError] = useState<string | null>(null);

  function loadUsers() {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then(setUsers);
  }
  function loadCompanies() {
    fetch("/api/admin/companies")
      .then((r) => r.json())
      .then(setCompanies);
  }
  useEffect(() => {
    loadUsers();
    loadCompanies();
  }, []);

  async function updateUser(id: string, patch: Partial<Pick<User, "role" | "isActive" | "companyId">>) {
    await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    loadUsers();
  }

  async function inviteUser(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name: name || undefined, role, companyId: companyId || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(describeApiError(data));
        return;
      }
      setEmail("");
      setName("");
      setRole("REQUESTER");
      setCompanyId("");
      setShowInvite(false);
      loadUsers();
    } finally {
      setInviting(false);
    }
  }

  async function addCompany(e: React.FormEvent) {
    e.preventDefault();
    setAddingCompany(true);
    setCompanyError(null);
    try {
      const res = await fetch("/api/admin/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: companyName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCompanyError(describeApiError(data));
        return;
      }
      setCompanyName("");
      setShowAddCompany(false);
      loadCompanies();
    } finally {
      setAddingCompany(false);
    }
  }

  async function removeCompany(id: string, name: string) {
    if (!confirm(`Delete "${name}"? Users keep their account but lose this company tag.`)) return;
    await fetch(`/api/admin/companies/${id}`, { method: "DELETE" });
    loadCompanies();
    loadUsers();
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Users &amp; Companies</h1>
          <p className="mt-1 text-sm text-slate-600">
            This is an invite-only helpdesk — sign-in only works for an email you&apos;ve added here.
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
          <button
            onClick={() => setTab("users")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === "users" ? "bg-indigo-50 text-indigo-700" : "text-slate-700 hover:text-slate-900"}`}
          >
            Users
          </button>
          <button
            onClick={() => setTab("companies")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === "companies" ? "bg-indigo-50 text-indigo-700" : "text-slate-700 hover:text-slate-900"}`}
          >
            Companies
          </button>
        </div>
      </div>

      {tab === "users" && (
        <>
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => setShowInvite(!showInvite)}
              className="shrink-0 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              {showInvite ? "Cancel" : "Invite user"}
            </button>
          </div>

          {showInvite && (
            <form onSubmit={inviteUser} className="mt-3 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-4">
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name (optional)"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as typeof role)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="REQUESTER">User</option>
                <option value="AGENT">Technician</option>
                <option value="TENANT_ADMIN">Admin</option>
              </select>
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">No company</option>
                {companies?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {error && <p className="text-sm text-red-600 sm:col-span-4">{error}</p>}
              <button
                type="submit"
                disabled={inviting}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 sm:col-span-4"
              >
                {inviting ? "Inviting…" : "Send invite"}
              </button>
            </form>
          )}

          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="p-4">Name</th>
                  <th className="p-4">Company</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">2FA</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users?.map((u) => (
                  <tr key={u.id}>
                    <td className="p-4">
                      <p className="font-medium text-slate-900">
                        {u.name ?? "—"}
                        {u._count.accounts === 0 && (
                          <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                            Pending sign-in
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-700">{u.email}</p>
                    </td>
                    <td className="p-4">
                      <select
                        value={u.companyId ?? ""}
                        onChange={(e) => updateUser(u.id, { companyId: e.target.value || null })}
                        className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                      >
                        <option value="">No company</option>
                        {companies?.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-4">
                      <select
                        value={u.role}
                        disabled={u.role === "SUPER_ADMIN"}
                        onChange={(e) => updateUser(u.id, { role: e.target.value as User["role"] })}
                        className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                      >
                        <option value="REQUESTER">User</option>
                        <option value="AGENT">Technician</option>
                        <option value="TENANT_ADMIN">Admin</option>
                        {u.role === "SUPER_ADMIN" && <option value="SUPER_ADMIN">{ROLE_LABELS.SUPER_ADMIN}</option>}
                      </select>
                    </td>
                    <td className="p-4 text-slate-700">{u.twoFactorEnabled ? "Enabled" : "Not set up"}</td>
                    <td className="p-4">
                      <button
                        onClick={() => updateUser(u.id, { isActive: !u.isActive })}
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          u.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {u.isActive ? "Active" : "Disabled"}
                      </button>
                    </td>
                  </tr>
                ))}
                {users?.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-sm text-slate-600">
                      No users yet — invite someone above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "companies" && (
        <>
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => setShowAddCompany(!showAddCompany)}
              className="shrink-0 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              {showAddCompany ? "Cancel" : "Add company"}
            </button>
          </div>

          {showAddCompany && (
            <form onSubmit={addCompany} className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-5">
              <input
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Company name (e.g. Willowbrook Primary School)"
                className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              {companyError && <p className="w-full text-sm text-red-600">{companyError}</p>}
              <button
                type="submit"
                disabled={addingCompany}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {addingCompany ? "Adding…" : "Add"}
              </button>
            </form>
          )}

          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="p-4">Company</th>
                  <th className="p-4">Users</th>
                  <th className="p-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {companies?.map((c) => (
                  <tr key={c.id}>
                    <td className="p-4 font-medium text-slate-900">{c.name}</td>
                    <td className="p-4 text-slate-700">{c._count.users}</td>
                    <td className="p-4 text-right">
                      <button onClick={() => removeCompany(c.id, c.name)} className="text-xs text-red-600 hover:underline">
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {companies?.length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-6 text-center text-sm text-slate-600">
                      No companies yet — add one above to start tagging users.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
