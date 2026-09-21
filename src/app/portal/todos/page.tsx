"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import clsx from "clsx";

type Todo = { id: string; text: string; isDone: boolean };

export default function TodosPage() {
  const [todos, setTodos] = useState<Todo[] | null>(null);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function load() {
    fetch("/api/todos")
      .then((r) => r.json())
      .then(setTodos);
  }
  useEffect(load, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      setText("");
      load();
    } finally {
      setSubmitting(false);
    }
  }

  async function toggle(todo: Todo) {
    setTodos((prev) => prev?.map((t) => (t.id === todo.id ? { ...t, isDone: !t.isDone } : t)) ?? null);
    await fetch(`/api/todos/${todo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDone: !todo.isDone }),
    });
    load();
  }

  async function remove(id: string) {
    setTodos((prev) => prev?.filter((t) => t.id !== id) ?? null);
    await fetch(`/api/todos/${id}`, { method: "DELETE" });
  }

  const open = todos?.filter((t) => !t.isDone) ?? [];
  const done = todos?.filter((t) => t.isDone) ?? [];

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold text-slate-900">My to-do list</h1>
      <p className="mt-1 text-sm text-slate-600">Personal — only you can see this list.</p>

      <form onSubmit={create} className="mt-6 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a task…"
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={submitting || !text.trim()}
          className="flex shrink-0 items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          <Plus size={16} />
          Add
        </button>
      </form>

      <div className="mt-6 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
        {open.map((t) => (
          <div key={t.id} className="flex items-center gap-3 p-3">
            <input type="checkbox" checked={false} onChange={() => toggle(t)} className="h-4 w-4 shrink-0 rounded border-slate-300" />
            <span className="flex-1 text-sm text-slate-900">{t.text}</span>
            <button onClick={() => remove(t.id)} className="shrink-0 text-slate-400 hover:text-red-600">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {todos !== null && open.length === 0 && done.length === 0 && (
          <p className="p-6 text-sm text-slate-700">Nothing on your list yet.</p>
        )}
        {todos !== null && open.length === 0 && done.length > 0 && (
          <p className="p-6 text-sm text-slate-700">All caught up.</p>
        )}
      </div>

      {done.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-slate-600 hover:text-slate-900">
            {done.length} done
          </summary>
          <div className="mt-2 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
            {done.map((t) => (
              <div key={t.id} className="flex items-center gap-3 p-3">
                <input type="checkbox" checked onChange={() => toggle(t)} className="h-4 w-4 shrink-0 rounded border-slate-300" />
                <span className={clsx("flex-1 text-sm text-slate-500 line-through")}>{t.text}</span>
                <button onClick={() => remove(t.id)} className="shrink-0 text-slate-400 hover:text-red-600">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
