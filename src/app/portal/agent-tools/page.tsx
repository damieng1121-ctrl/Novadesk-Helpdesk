"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { AGENT_OS_LABELS, DEFAULT_AGENT_COMMANDS, DEFAULT_AGENT_CONSOLE_LINKS } from "@/lib/agent-tools";

type Os = "WINDOWS" | "MAC" | "CHROMEBOOK";
type Command = { id: string; title: string; command: string; description: string | null; os: Os };
type ConsoleLink = { id: string; title: string; url: string };

const OS_TABS: Os[] = ["WINDOWS", "MAC", "CHROMEBOOK"];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="shrink-0 rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export default function AgentToolsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user.role === "TENANT_ADMIN" || session?.user.role === "SUPER_ADMIN";

  const [os, setOs] = useState<Os>("WINDOWS");
  const [commands, setCommands] = useState<Command[] | null>(null);
  const [links, setLinks] = useState<ConsoleLink[] | null>(null);

  const [showCommandForm, setShowCommandForm] = useState(false);
  const [cmdTitle, setCmdTitle] = useState("");
  const [cmdCommand, setCmdCommand] = useState("");
  const [cmdDescription, setCmdDescription] = useState("");

  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  function load() {
    fetch("/api/agent-tools/commands").then((r) => r.json()).then(setCommands);
    fetch("/api/agent-tools/links").then((r) => r.json()).then(setLinks);
  }
  useEffect(load, []);

  async function createCommand(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/agent-tools/commands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: cmdTitle, command: cmdCommand, description: cmdDescription || undefined, os }),
    });
    setCmdTitle("");
    setCmdCommand("");
    setCmdDescription("");
    setShowCommandForm(false);
    load();
  }

  async function removeCommand(id: string) {
    await fetch(`/api/agent-tools/commands/${id}`, { method: "DELETE" });
    load();
  }

  async function createLink(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/agent-tools/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: linkTitle, url: linkUrl }),
    });
    setLinkTitle("");
    setLinkUrl("");
    setShowLinkForm(false);
    load();
  }

  async function removeLink(id: string) {
    await fetch(`/api/agent-tools/links/${id}`, { method: "DELETE" });
    load();
  }

  const customCommandsForOs = commands?.filter((c) => c.os === os) ?? [];

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Agent tools</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Quick-reference commands and admin console links for triaging tickets.</p>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1fr_22rem]">
        <div>
          <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800">
            {OS_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setOs(tab)}
                className={`px-4 py-2 text-sm font-medium ${
                  os === tab ? "border-b-2 border-indigo-600 text-indigo-700" : "text-slate-700 hover:text-slate-900"
                }`}
              >
                {AGENT_OS_LABELS[tab]}
              </button>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {DEFAULT_AGENT_COMMANDS[os].map((c) => (
              <div key={c.title} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 dark:text-slate-100">{c.title}</p>
                  <p className="mt-0.5 text-xs text-slate-700 dark:text-slate-300">{c.description}</p>
                  <code className="mt-1.5 block truncate rounded bg-slate-50 px-2 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">{c.command}</code>
                </div>
                <CopyButton text={c.command} />
              </div>
            ))}
            {customCommandsForOs.map((c) => (
              <div key={c.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 dark:text-slate-100">{c.title}</p>
                  {c.description && <p className="mt-0.5 text-xs text-slate-700 dark:text-slate-300">{c.description}</p>}
                  <code className="mt-1.5 block truncate rounded bg-slate-50 px-2 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">{c.command}</code>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <CopyButton text={c.command} />
                  {isAdmin && (
                    <button onClick={() => removeCommand(c.id)} className="text-xs text-red-600 hover:underline">
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {isAdmin && (
            <div className="mt-3">
              {showCommandForm ? (
                <form onSubmit={createCommand} className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 dark:border-slate-800 dark:bg-slate-900">
                  <input required value={cmdTitle} onChange={(e) => setCmdTitle(e.target.value)} placeholder="Title" className="rounded-md border border-slate-300 px-3 py-2 text-sm sm:col-span-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" />
                  <input required value={cmdCommand} onChange={(e) => setCmdCommand(e.target.value)} placeholder="Command" className="rounded-md border border-slate-300 px-3 py-2 text-sm font-mono sm:col-span-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" />
                  <input value={cmdDescription} onChange={(e) => setCmdDescription(e.target.value)} placeholder="Description (optional)" className="rounded-md border border-slate-300 px-3 py-2 text-sm sm:col-span-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" />
                  <div className="flex gap-2 sm:col-span-2">
                    <button type="submit" className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                      Add for {AGENT_OS_LABELS[os]}
                    </button>
                    <button type="button" onClick={() => setShowCommandForm(false)} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500">
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button onClick={() => setShowCommandForm(true)} className="text-sm text-indigo-700 hover:underline dark:text-indigo-300">
                  + Add a {AGENT_OS_LABELS[os]} command
                </button>
              )}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Admin console links</h2>
          <div className="mt-3 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
            {DEFAULT_AGENT_CONSOLE_LINKS.map((l) => (
              <a key={l.title} href={l.url} target="_blank" rel="noreferrer" className="block p-4 text-sm text-indigo-700 hover:bg-slate-50 hover:underline dark:text-indigo-300 dark:hover:bg-slate-800">
                {l.title}
              </a>
            ))}
            {links?.map((l) => (
              <div key={l.id} className="flex items-center justify-between p-4">
                <a href={l.url} target="_blank" rel="noreferrer" className="text-sm text-indigo-700 hover:underline dark:text-indigo-300">
                  {l.title}
                </a>
                {isAdmin && (
                  <button onClick={() => removeLink(l.id)} className="text-xs text-red-600 hover:underline">
                    Delete
                  </button>
                )}
              </div>
            ))}
          </div>

          {isAdmin && (
            <div className="mt-3">
              {showLinkForm ? (
                <form onSubmit={createLink} className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                  <input required value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} placeholder="Title" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" />
                  <input required type="url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" />
                  <div className="flex gap-2">
                    <button type="submit" className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                      Add
                    </button>
                    <button type="button" onClick={() => setShowLinkForm(false)} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500">
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button onClick={() => setShowLinkForm(true)} className="text-sm text-indigo-700 hover:underline dark:text-indigo-300">
                  + Add a console link
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
