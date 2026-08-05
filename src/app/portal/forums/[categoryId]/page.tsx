"use client";

import Link from "next/link";
import { useEffect, useState, use as usePromise } from "react";

type Topic = {
  id: string;
  title: string;
  pinned: boolean;
  views: number;
  updatedAt: string;
  author: { name: string | null; email: string | null };
  _count: { replies: number };
};

export default function ForumCategoryPage({ params }: PageProps<"/portal/forums/[categoryId]">) {
  const { categoryId } = usePromise(params);
  const [topics, setTopics] = useState<Topic[] | null>(null);

  useEffect(() => {
    fetch(`/api/forums/topics?categoryId=${categoryId}`)
      .then((r) => r.json())
      .then(setTopics);
  }, [categoryId]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <Link href="/portal/forums" className="text-sm text-blue-600 hover:underline">
            ← Forums
          </Link>
        </div>
        <Link
          href={`/portal/forums/${categoryId}/new`}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          New topic
        </Link>
      </div>

      <div className="mt-4 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
        {topics?.map((t) => (
          <Link key={t.id} href={`/portal/forums/${categoryId}/${t.id}`} className="block p-4 hover:bg-slate-50">
            <div className="flex items-center justify-between">
              <p className="font-medium text-slate-900">
                {t.pinned && <span className="mr-2 text-xs text-blue-600">PINNED</span>}
                {t.title}
              </p>
              <p className="text-xs text-slate-600">{t._count.replies} replies · {t.views} views</p>
            </div>
            <p className="mt-1 text-xs text-slate-700">
              {t.author.name ?? t.author.email} · {new Date(t.updatedAt).toLocaleDateString("en-GB")}
            </p>
          </Link>
        ))}
        {topics?.length === 0 && <p className="p-6 text-sm text-slate-700">No topics yet — start the conversation.</p>}
      </div>
    </div>
  );
}
