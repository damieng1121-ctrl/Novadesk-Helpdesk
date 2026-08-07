"use client";

import Link from "next/link";
import { useEffect, useState, use as usePromise } from "react";

type Person = { name: string | null; email: string | null };
type Reply = { id: string; content: string; createdAt: string; author: Person & { role: string } };
type Topic = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  author: Person;
  category: { title: string };
  replies: Reply[];
};

export default function TopicDetailPage({ params }: PageProps<"/portal/forums/[categoryId]/[topicId]">) {
  const { categoryId, topicId } = usePromise(params);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [reply, setReply] = useState("");
  const [posting, setPosting] = useState(false);

  function load() {
    fetch(`/api/forums/topics/${topicId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setTopic);
  }
  useEffect(load, [topicId]);

  async function postReply(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim()) return;
    setPosting(true);
    try {
      await fetch(`/api/forums/topics/${topicId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: reply }),
      });
      setReply("");
      load();
    } finally {
      setPosting(false);
    }
  }

  if (!topic) return <p className="text-sm text-slate-700">Loading…</p>;

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/portal/forums/${categoryId}`} className="text-sm text-indigo-600 hover:underline">
        ← {topic.category.title}
      </Link>

      <h1 className="mt-2 text-2xl font-semibold text-slate-900">{topic.title}</h1>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
        <p className="whitespace-pre-wrap text-sm text-slate-700">{topic.content}</p>
        <p className="mt-3 text-xs text-slate-600">
          {topic.author.name ?? topic.author.email} · {new Date(topic.createdAt).toLocaleString("en-GB")}
        </p>
      </div>

      <div className="mt-6 space-y-4">
        {topic.replies.map((r) => (
          <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
            <div className="flex items-center justify-between">
              <p className="font-medium text-slate-900">{r.author.name ?? r.author.email}</p>
              <p className="text-xs text-slate-600">{new Date(r.createdAt).toLocaleString("en-GB")}</p>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-slate-700">{r.content}</p>
          </div>
        ))}
        {topic.replies.length === 0 && <p className="text-sm text-slate-600">No replies yet.</p>}
      </div>

      <form onSubmit={postReply} className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
        <textarea
          rows={3}
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Write a reply…"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <div className="mt-3 flex justify-end">
          <button
            type="submit"
            disabled={posting || !reply.trim()}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {posting ? "Posting…" : "Post reply"}
          </button>
        </div>
      </form>
    </div>
  );
}
