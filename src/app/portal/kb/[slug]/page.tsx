"use client";

import { useEffect, useState, use as usePromise } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

type Article = {
  id: string;
  title: string;
  content: string;
  status: string;
  category: { name: string } | null;
  author: { name: string | null; email: string | null };
  updatedAt: string;
};

export default function KbArticlePage({ params }: PageProps<"/portal/kb/[slug]">) {
  const { slug } = usePromise(params);
  const { data: session } = useSession();
  const router = useRouter();
  const isAdmin = session?.user.role === "TENANT_ADMIN" || session?.user.role === "SUPER_ADMIN";
  const [article, setArticle] = useState<Article | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/kb/${slug}`).then((r) => {
      if (!r.ok) {
        setNotFound(true);
        return;
      }
      r.json().then(setArticle);
    });
  }, [slug]);

  async function moveToTrash() {
    if (!confirm("Move this article to the trash?")) return;
    await fetch(`/api/kb/${slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDeleted: true }),
    });
    router.push("/portal/kb");
  }

  if (notFound) return <p className="text-sm text-slate-700">Article not found.</p>;
  if (!article) return <p className="text-sm text-slate-700">Loading…</p>;

  return (
    <article className="mx-auto max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-600">
            {article.category?.name ?? "General"}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">{article.title}</h1>
          <p className="mt-2 text-xs text-slate-600">
            By {article.author.name ?? article.author.email} · updated {new Date(article.updatedAt).toLocaleDateString("en-GB")}
          </p>
        </div>
        {isAdmin && (
          <button onClick={moveToTrash} className="rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50">
            Move to trash
          </button>
        )}
      </div>
      <div className="mt-6 whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-6 text-sm leading-relaxed text-slate-700">
        {article.content}
      </div>
    </article>
  );
}
