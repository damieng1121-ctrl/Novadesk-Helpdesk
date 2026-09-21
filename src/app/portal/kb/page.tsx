"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";

type Article = {
  id: string;
  title: string;
  slug: string;
  status: string;
  viewCount: number;
  category: { name: string } | null;
};

const STAFF_ROLES = new Set(["AGENT", "TENANT_ADMIN", "SUPER_ADMIN"]);

export default function KbListPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-700 dark:text-slate-300">Loading…</p>}>
      <KbList />
    </Suspense>
  );
}

function KbList() {
  const { data: session } = useSession();
  const staff = !!session?.user && STAFF_ROLES.has(session.user.role);
  const searchParams = useSearchParams();
  const [articles, setArticles] = useState<Article[] | null>(null);
  const [q, setQ] = useState(searchParams.get("q") ?? "");

  useEffect(() => {
    const qs = q ? `?q=${encodeURIComponent(q)}` : "";
    fetch(`/api/kb${qs}`)
      .then((r) => r.json())
      .then(setArticles);
  }, [q]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Knowledge base</h1>
        {staff && (
          <Link
            href="/portal/kb/new"
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            New article
          </Link>
        )}
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search articles…"
        className="mt-4 w-full max-w-md rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
      />

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {articles?.map((a) => (
          <Link
            key={a.id}
            href={`/portal/kb/${a.slug}`}
            className="rounded-xl border border-slate-200 bg-white p-5 hover:border-indigo-300 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-600 dark:text-slate-400">
                {a.category?.name ?? "General"}
              </p>
              {staff && a.status !== "PUBLISHED" && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400 dark:bg-amber-950">
                  {a.status}
                </span>
              )}
            </div>
            <h3 className="mt-2 font-semibold text-slate-900 dark:text-slate-100">{a.title}</h3>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">{a.viewCount} views</p>
          </Link>
        ))}
        {articles?.length === 0 && <p className="text-sm text-slate-700 dark:text-slate-300">No articles yet.</p>}
      </div>
    </div>
  );
}
