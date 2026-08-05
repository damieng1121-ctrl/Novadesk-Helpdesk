"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

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

type PlatformUser = {
  id: string;
  name: string | null;
  email: string | null;
  role: "SUPER_ADMIN" | "TENANT_ADMIN" | "AGENT" | "REQUESTER";
  tenantId: string | null;
  tenant: { name: string } | null;
  isActive: boolean;
  twoFactorEnabled: boolean;
  _count: { accounts: number };
};

const PHASES = ["NURSERY", "PRIMARY", "SECONDARY", "ALL_THROUGH", "SPECIAL", "MULTI_ACADEMY_TRUST"];
const ROLES = ["REQUESTER", "AGENT", "TENANT_ADMIN", "SUPER_ADMIN"] as const;

/** Turns withApiErrors' {error, issues} shape into a readable message instead of the generic "Invalid request". */
function describeApiError(data: { error?: string; issues?: { path: (string | number)[]; message: string }[] }): string {
  if (data.issues?.length) {
    return data.issues.map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message)).join("; ");
  }
  return data.error ?? "Something went wrong";
}

export default function SuperAdminPage() {
  const { update } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState<"schools" | "users">("schools");
  const [managingId, setManagingId] = useState<string | null>(null);

  async function manageSchool(id: string) {
    setManagingId(id);
    try {
      await update({ actingTenantId: id });
      router.push("/portal");
    } finally {
      setManagingId(null);
    }
  }

  const [tenants, setTenants] = useState<Tenant[] | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [domain, setDomain] = useState("");
  const [phase, setPhase] = useState("PRIMARY");
  const [urn, setUrn] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [users, setUsers] = useState<PlatformUser[] | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [uEmail, setUEmail] = useState("");
  const [uName, setUName] = useState("");
  const [uRole, setURole] = useState<(typeof ROLES)[number]>("REQUESTER");
  const [uTenantId, setUTenantId] = useState("");
  const [uError, setUError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);

  function loadTenants() {
    fetch("/api/super-admin/tenants")
      .then((r) => r.json())
      .then(setTenants);
  }
  function loadUsers() {
    fetch("/api/super-admin/users")
      .then((r) => r.json())
      .then(setUsers);
  }
  useEffect(() => {
    loadTenants();
    loadUsers();
  }, []);

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
        setError(describeApiError(data));
        return;
      }
      setName("");
      setSlug("");
      setDomain("");
      setUrn("");
      loadTenants();
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
    loadTenants();
  }

  async function inviteUser(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setUError(null);
    try {
      const res = await fetch("/api/super-admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: uEmail,
          name: uName || undefined,
          role: uRole,
          tenantId: uRole === "SUPER_ADMIN" ? null : uTenantId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setUError(describeApiError(data));
        return;
      }
      setUEmail("");
      setUName("");
      setURole("REQUESTER");
      setUTenantId("");
      setShowInvite(false);
      loadUsers();
    } finally {
      setInviting(false);
    }
  }

  async function reassignUser(id: string, patch: Partial<Pick<PlatformUser, "role" | "tenantId" | "isActive">>) {
    await fetch(`/api/super-admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    loadUsers();
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Platform administration</h1>
          <p className="mt-1 text-sm text-slate-600">Manage every school and every user across Novadesk.</p>
        </div>
        <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
          <button
            onClick={() => setTab("schools")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === "schools" ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:text-slate-700"}`}
          >
            Schools
          </button>
          <button
            onClick={() => setTab("users")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === "users" ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:text-slate-700"}`}
          >
            Users
          </button>
        </div>
      </div>

      {tab === "schools" && (
        <>
          <p className="mt-4 text-sm text-slate-600">
            Onboard a new school by registering its Google Workspace domain — the first person who
            signs in from that domain is auto-provisioned as a Requester.
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
                  <th className="p-4"></th>
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
                    <td className="p-4 text-right">
                      <button
                        onClick={() => manageSchool(t.id)}
                        disabled={managingId === t.id || !t.isActive}
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        {managingId === t.id ? "Opening…" : "Manage"}
                      </button>
                    </td>
                  </tr>
                ))}
                {tenants?.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-sm text-slate-500">
                      No schools yet — add one above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "users" && (
        <>
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-slate-600">
              Every user across every school, plus platform staff. Add someone directly, or move an
              existing user to a different school.
            </p>
            <button
              onClick={() => setShowInvite(!showInvite)}
              className="shrink-0 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              {showInvite ? "Cancel" : "Add user"}
            </button>
          </div>

          {showInvite && (
            <form onSubmit={inviteUser} className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-4">
              <input
                required
                type="email"
                value={uEmail}
                onChange={(e) => setUEmail(e.target.value)}
                placeholder="Email address"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                value={uName}
                onChange={(e) => setUName(e.target.value)}
                placeholder="Name (optional)"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <select
                value={uRole}
                onChange={(e) => setURole(e.target.value as typeof uRole)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r === "SUPER_ADMIN" ? "Super admin (platform)" : r.charAt(0) + r.slice(1).toLowerCase().replace("_", " ")}
                  </option>
                ))}
              </select>
              <select
                value={uTenantId}
                disabled={uRole === "SUPER_ADMIN"}
                onChange={(e) => setUTenantId(e.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="">Select a school…</option>
                {tenants?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              {uError && <p className="text-sm text-red-600 sm:col-span-4">{uError}</p>}
              <button
                type="submit"
                disabled={inviting}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 sm:col-span-4"
              >
                {inviting ? "Adding…" : "Add user"}
              </button>
            </form>
          )}

          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="p-4">Name</th>
                  <th className="p-4">School</th>
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
                      <p className="text-xs text-slate-500">{u.email}</p>
                    </td>
                    <td className="p-4">
                      {u.role === "SUPER_ADMIN" ? (
                        <span className="text-xs text-slate-400">Platform (no school)</span>
                      ) : (
                        <select
                          value={u.tenantId ?? ""}
                          onChange={(e) => reassignUser(u.id, { tenantId: e.target.value || null })}
                          className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                        >
                          <option value="" disabled>
                            Select a school…
                          </option>
                          {tenants?.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="p-4">
                      <select
                        value={u.role}
                        onChange={(e) => {
                          const newRole = e.target.value as PlatformUser["role"];
                          reassignUser(u.id, { role: newRole, tenantId: newRole === "SUPER_ADMIN" ? null : u.tenantId });
                        }}
                        className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                      >
                        <option value="REQUESTER">Requester</option>
                        <option value="AGENT">Agent</option>
                        <option value="TENANT_ADMIN">Admin</option>
                        <option value="SUPER_ADMIN">Super admin</option>
                      </select>
                    </td>
                    <td className="p-4 text-slate-500">{u.twoFactorEnabled ? "Enabled" : "Not set up"}</td>
                    <td className="p-4">
                      <button
                        onClick={() => reassignUser(u.id, { isActive: !u.isActive })}
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          u.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {u.isActive ? "Active" : "Disabled"}
                      </button>
                    </td>
                  </tr>
                ))}
                {users?.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-sm text-slate-500">
                      No users yet.
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
