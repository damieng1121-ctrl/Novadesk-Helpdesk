"use client";

import { useEffect, useState } from "react";

type User = {
  id: string;
  name: string | null;
  email: string | null;
  role: "SUPER_ADMIN" | "TENANT_ADMIN" | "AGENT" | "REQUESTER";
  isActive: boolean;
  twoFactorEnabled: boolean;
};

export default function UsersAdminPage() {
  const [users, setUsers] = useState<User[] | null>(null);

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

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Users</h1>
      <p className="mt-1 text-sm text-slate-600">
        Anyone signing in with a matching Google Workspace account is added automatically as a Requester.
        Promote staff to Agent or Admin here.
      </p>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
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
                  <p className="font-medium text-slate-900">{u.name ?? "—"}</p>
                  <p className="text-xs text-slate-500">{u.email}</p>
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
                <td className="p-4 text-slate-500">{u.twoFactorEnabled ? "Enabled" : "Not set up"}</td>
                <td className="p-4">
                  <button
                    onClick={() => updateUser(u.id, { isActive: !u.isActive })}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      u.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
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
