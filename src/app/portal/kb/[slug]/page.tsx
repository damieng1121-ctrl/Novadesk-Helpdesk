"use client";

import { useEffect, useState, use as usePromise } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

type Category = { id: string; name: string };
type Article = {
  id: string;
  slug: string;
  title: string;
  content: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  category: { id: string; name: string } | null;
  author: { name: string | null; email: string | null };
  updatedAt: string;
};

const STATUS_LABELS: Record<Article["status"], string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
};

const STATUS_STYLES: Record<Article["status"], string> = {
  DRAFT: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  PUBLISHED: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  ARCHIVED: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

export default function KbArticlePage({ params }: PageProps<"/portal/kb/[slug]">) {
  const { slug } = usePromise(params);
  const { data: session } = useSession();
  const router = useRouter();
  const isStaff = session?.user.role && session.user.role !== "REQUESTER";

  const [article, setArticle] = useState<Article | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    fetch(`/api/kb/${slug}`).then((r) => {
      if (!r.ok) {
        setNotFound(true);
        return;
      }
      r.json().then((a: Article) => {
        setArticle(a);
        setTitle(a.title);
        setContent(a.content);
        setCategoryId(a.category?.id ?? "");
      });
    });
  }
  useEffect(load, [slug]);

  useEffect(() => {
    if (!isStaff) return;
    fetch("/api/kb/categories")
      .then((r) => (r.ok ? r.json() : []))
      .then(setCategories);
  }, [isStaff]);

  async function updateArticle(patch: Record<string, unknown>) {
    const res = await fetch(`/api/kb/${slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) load();
    return res.ok;
  }

  async function setStatus(status: Article["status"]) {
    await updateArticle({ status });
  }

  async function saveEdits(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const ok = await updateArticle({ title, content, categoryId: categoryId || null });
      if (ok) setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  async function moveToTrash() {
    if (!confirm("Move this article to the trash?")) return;
    await updateArticle({ isDeleted: true });
    router.push("/portal/kb");
  }

  if (notFound) return <p className="text-sm text-slate-700 dark:text-slate-300">Article not found.</p>;
  if (!article) return <p className="text-sm text-slate-700 dark:text-slate-300">Loading…</p>;

  if (editing) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Edit article</h1>
        <form onSubmit={saveEdits} className="mt-6 space-y-5 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Title</label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
            >
              <option value="">General</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Content</label>
            <textarea
              required
              rows={14}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-indigo-600 px-5 py-2.5 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setTitle(article.title);
                setContent(article.content);
                setCategoryId(article.category?.id ?? "");
                setEditing(false);
              }}
              className="text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-3xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-600 dark:text-slate-400">
              {article.category?.name ?? "General"}
            </p>
            {isStaff && (
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[article.status]}`}>
                {STATUS_LABELS[article.status]}
              </span>
            )}
          </div>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{article.title}</h1>
          <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
            By {article.author.name ?? article.author.email} · updated {new Date(article.updatedAt).toLocaleDateString("en-GB")}
          </p>
        </div>
        {isStaff && (
          <div className="flex shrink-0 flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEditing(true)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Edit
              </button>
              <button
                onClick={moveToTrash}
                className="rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
              >
                Move to trash
              </button>
            </div>
            {article.status === "DRAFT" && (
              <button
                onClick={() => setStatus("PUBLISHED")}
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
              >
                Publish
              </button>
            )}
            {article.status === "PUBLISHED" && (
              <button
                onClick={() => setStatus("DRAFT")}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Unpublish (back to Draft)
              </button>
            )}
            {article.status === "ARCHIVED" && (
              <button
                onClick={() => setStatus("PUBLISHED")}
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
              >
                Republish
              </button>
            )}
            {article.status !== "ARCHIVED" && (
              <button
                onClick={() => setStatus("ARCHIVED")}
                className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300"
              >
                Archive
              </button>
            )}
          </div>
        )}
      </div>
      <div className="mt-6 whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-6 text-sm leading-relaxed text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        {article.content}
      </div>
    </article>
  );
}
