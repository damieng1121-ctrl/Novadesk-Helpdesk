"use client";

import { useEffect, useState } from "react";

type User = {
  id: string;
  name: string | null;
  email: string | null;
  role: "SUPER_ADMIN" | "TENANT_ADMIN" | "AGENT" | "REQUESTER";
  isActive: boolean;
  twoFactorEnabled: boolean;
  _count: { accounts: number };
};

export default function UsersAdminPage() {
  const [users, setUsers] = useState<User[] | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"REQUESTER" | "AGENT" | "TENANT_ADMIN">("REQUESTER");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then(setUsers);
  }
  useEffect(load, []);

  async function updateUser(id: string, patch: Partial<Pick<User, "role" | "isActive">>) {
    await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    load();
  }

  async function inviteUser(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name: name || undefined, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      setEmail("");
      setName("");
      setRole("REQUESTER");
      setShowInvite(false);
      load();
    } finally {
      setInviting(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Users</h1>
          <p className="mt-1 text-sm text-slate-600">
            Anyone signing in with a matching Google Workspace account is added automatically as a
            Requester. Invite someone directly to pre-assign their school and role — e.g. a personal
            email, or staff whose email domain doesn&apos;t match this school.
          </p>
        </div>
        <button
          onClick={() => setShowInvite(!showInvite)}
          className="shrink-0 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          {showInvite ? "Cancel" : "Invite user"}
        </button>
      </div>

      {showInvite && (
        <form onSubmit={inviteUser} className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-3">
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm sm:col-span-1"
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (optional)"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm sm:col-span-1"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as typeof role)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm sm:col-span-1"
          >
            <option value="REQUESTER">Requester</option>
            <option value="AGENT">Agent</option>
            <option value="TENANT_ADMIN">Admin</option>
          </select>
          {error && <p className="text-sm text-red-600 sm:col-span-3">{error}</p>}
          <button
            type="submit"
            disabled={inviting}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 sm:col-span-3"
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
                    value={u.role}
                    disabled={u.role === "SUPER_ADMIN"}
                    onChange={(e) => updateUser(u.id, { role: e.target.value as User["role"] })}
                    className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                  >
                    <option value="REQUESTER">Requester</option>
                    <option value="AGENT">Agent</option>
                    <option value="TENANT_ADMIN">Admin</option>
                    {u.role === "SUPER_ADMIN" && <option value="SUPER_ADMIN">Super admin</option>}
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
          </tbody>
        </table>
      </div>
    </div>
  );
}
