"use client";

import { useEffect, useRef, useState, use as usePromise } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bold, Italic, Heading2, List, ListOrdered, Link as LinkIcon, Code, Quote, Paperclip, X } from "lucide-react";

type Category = { id: string; name: string };
type Attachment = { id: string; fileName: string; fileSize: number | null; contentType: string | null };
type Article = {
  id: string;
  slug: string;
  title: string;
  content: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  category: { id: string; name: string } | null;
  author: { name: string | null; email: string | null };
  updatedAt: string;
  attachments: Attachment[];
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

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentList({ slug, attachments }: { slug: string; attachments: Attachment[] }) {
  if (attachments.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {attachments.map((a) => (
        <a
          key={a.id}
          href={`/api/kb/${slug}/attachments/${a.id}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          <Paperclip size={12} className="shrink-0" />
          {a.fileName}
          {a.fileSize ? <span className="text-slate-600 dark:text-slate-400">({formatFileSize(a.fileSize)})</span> : null}
        </a>
      ))}
    </div>
  );
}

/** Wraps or inserts markdown syntax around the current selection in a textarea, then restores focus/selection. */
function applyMarkdown(
  textarea: HTMLTextAreaElement,
  content: string,
  setContent: (v: string) => void,
  before: string,
  after: string = before,
  placeholder = "text",
) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = content.slice(start, end) || placeholder;
  const next = content.slice(0, start) + before + selected + after + content.slice(end);
  setContent(next);
  requestAnimationFrame(() => {
    textarea.focus();
    textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
  });
}

/** Prefixes the current line(s) with a marker, e.g. "## ", "- ", "1. ", "> ". */
function applyLinePrefix(
  textarea: HTMLTextAreaElement,
  content: string,
  setContent: (v: string) => void,
  prefix: string,
) {
  const start = textarea.selectionStart;
  const lineStart = content.lastIndexOf("\n", start - 1) + 1;
  const next = content.slice(0, lineStart) + prefix + content.slice(lineStart);
  setContent(next);
  requestAnimationFrame(() => {
    textarea.focus();
    textarea.setSelectionRange(start + prefix.length, start + prefix.length);
  });
}

function MarkdownToolbar({
  textareaRef,
  content,
  setContent,
}: {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  content: string;
  setContent: (v: string) => void;
}) {
  type ButtonSpec =
    | { icon: React.ElementType; label: string; kind: "wrap"; before: string; after?: string; placeholder?: string }
    | { icon: React.ElementType; label: string; kind: "prefix"; prefix: string };

  const buttons: ButtonSpec[] = [
    { icon: Bold, label: "Bold", kind: "wrap", before: "**" },
    { icon: Italic, label: "Italic", kind: "wrap", before: "_" },
    { icon: Heading2, label: "Heading", kind: "prefix", prefix: "## " },
    { icon: List, label: "Bullet list", kind: "prefix", prefix: "- " },
    { icon: ListOrdered, label: "Numbered list", kind: "prefix", prefix: "1. " },
    { icon: Quote, label: "Quote", kind: "prefix", prefix: "> " },
    { icon: Code, label: "Code", kind: "wrap", before: "`" },
    { icon: LinkIcon, label: "Link", kind: "wrap", before: "[", after: "](https://)", placeholder: "link text" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-t-md border border-b-0 border-slate-300 bg-slate-50 p-1.5 dark:border-slate-700 dark:bg-slate-800">
      {buttons.map((b) => (
        <button
          key={b.label}
          type="button"
          onClick={() => {
            const t = textareaRef.current;
            if (!t) return;
            if (b.kind === "wrap") applyMarkdown(t, content, setContent, b.before, b.after, b.placeholder);
            else applyLinePrefix(t, content, setContent, b.prefix);
          }}
          title={b.label}
          aria-label={b.label}
          className="rounded p-1.5 text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          <b.icon size={15} />
        </button>
      ))}
    </div>
  );
}

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
  const [preview, setPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  async function uploadAttachment(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.set("file", file);
      const res = await fetch(`/api/kb/${slug}/attachments`, { method: "POST", body: form });
      if (res.ok) load();
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function removeAttachment(id: string) {
    await fetch(`/api/kb/${slug}/attachments/${id}`, { method: "DELETE" });
    load();
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
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Content (Markdown)</label>
              <button
                type="button"
                onClick={() => setPreview((p) => !p)}
                className="text-xs font-medium text-indigo-600 hover:underline"
              >
                {preview ? "Back to editing" : "Preview"}
              </button>
            </div>
            {preview ? (
              <div className="mt-1 min-h-[22rem] rounded-md border border-slate-300 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{content || "*Nothing to preview yet.*"}</ReactMarkdown>
                </div>
              </div>
            ) : (
              <>
                <MarkdownToolbar textareaRef={textareaRef} content={content} setContent={setContent} />
                <textarea
                  ref={textareaRef}
                  required
                  rows={16}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full rounded-b-md border border-slate-300 px-3 py-2 font-mono text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
                />
              </>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Attachments</label>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {article.attachments.map((a) => (
                <span
                  key={a.id}
                  className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300"
                >
                  <Paperclip size={12} />
                  {a.fileName}
                  <button
                    type="button"
                    onClick={() => removeAttachment(a.id)}
                    className="text-slate-400 hover:text-red-600"
                    aria-label={`Remove ${a.fileName}`}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
              <label className="cursor-pointer rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800">
                {uploading ? "Uploading…" : "+ Attach file"}
                <input type="file" className="hidden" disabled={uploading} onChange={uploadAttachment} />
              </label>
            </div>
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
                setPreview(false);
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
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 text-sm leading-relaxed text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{article.content}</ReactMarkdown>
        </div>
        <AttachmentList slug={article.slug} attachments={article.attachments} />
      </div>
    </article>
  );
}
