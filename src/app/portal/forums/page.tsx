"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type Category = {
  id: string;
  title: string;
  description: string | null;
  visibility: "PUBLIC" | "INTERNAL";
  _count: { topics: number };
};

export default function ForumsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user.role === "TENANT_ADMIN" || session?.user.role === "SUPER_ADMIN";
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"PUBLIC" | "INTERNAL">("PUBLIC");

  function load() {
    fetch("/api/forums/categories")
      .then((r) => r.json())
      .then(setCategories);
  }
  useEffect(load, []);

  async function createCategory(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/forums/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, visibility }),
    });
    setTitle("");
    setDescription("");
    setShowForm(false);
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Forums</h1>
        {isAdmin && (
          <button onClick={() => setShowForm(!showForm)} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            {showForm ? "Cancel" : "New category"}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={createCategory} className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-white p-5">
          <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Category title" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <select value={visibility} onChange={(e) => setVisibility(e.target.value as "PUBLIC" | "INTERNAL")} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="PUBLIC">Public (visible to everyone)</option>
            <option value="INTERNAL">Internal (staff only)</option>
          </select>
          <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Create
          </button>
        </form>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {categories?.map((c) => (
          <Link key={c.id} href={`/portal/forums/${c.id}`} className="rounded-xl border border-slate-200 bg-white p-5 hover:border-blue-300">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">{c.title}</h3>
              {c.visibility === "INTERNAL" && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Staff only</span>
              )}
            </div>
            {c.description && <p className="mt-1 text-sm text-slate-500">{c.description}</p>}
            <p className="mt-2 text-xs text-slate-400">{c._count.topics} topic{c._count.topics === 1 ? "" : "s"}</p>
          </Link>
        ))}
        {categories?.length === 0 && <p className="text-sm text-slate-500">No forum categories yet.</p>}
      </div>
    </div>
  );
}
