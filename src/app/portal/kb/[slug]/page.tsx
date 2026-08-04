"use client";

import { useEffect, useState, use as usePromise } from "react";

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

  if (notFound) return <p className="text-sm text-slate-500">Article not found.</p>;
  if (!article) return <p className="text-sm text-slate-500">Loading…</p>;

  return (
    <article className="mx-auto max-w-3xl">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {article.category?.name ?? "General"}
      </p>
      <h1 className="mt-1 text-2xl font-semibold text-slate-900">{article.title}</h1>
      <p className="mt-2 text-xs text-slate-400">
        By {article.author.name ?? article.author.email} · updated {new Date(article.updatedAt).toLocaleDateString("en-GB")}
      </p>
      <div className="mt-6 whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-6 text-sm leading-relaxed text-slate-700">
        {article.content}
      </div>
    </article>
  );
}
