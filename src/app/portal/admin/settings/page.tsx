"use client";

import { useEffect, useState } from "react";

type AiConfig = {
  provider: "CLAUDE" | "GEMINI" | "DISABLED";
  model: string | null;
  hasOwnApiKey: boolean;
  ticketTriageEnabled: boolean;
  kbSuggestionsEnabled: boolean;
};
type Tenant = { name: string; logoUrl: string | null; brandColor: string; urn: string | null };
type UsefulLink = { id: string; title: string; url: string };
type PortalSettings = {
  heroTitle: string;
  heroSubtitle: string;
  heroShowSearch: boolean;
  showAnnouncements: boolean;
  showQuickActions: boolean;
  showPopularArticles: boolean;
  showUrgentHelp: boolean;
  showUsefulLinks: boolean;
  usefulLinks: UsefulLink[];
  urgentHelpEnabled: boolean;
  urgentHelpTitle: string;
  urgentHelpDescription: string;
  urgentHelpHotline: string;
  urgentHelpEmail: string;
  urgentHelpAvailability: string;
};

export default function AdminSettingsPage() {
  const [ai, setAi] = useState<AiConfig | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [savingAi, setSavingAi] = useState(false);
  const [savingTenant, setSavingTenant] = useState(false);
  const [portal, setPortal] = useState<PortalSettings | null>(null);
  const [savingPortal, setSavingPortal] = useState(false);

  useEffect(() => {
    fetch("/api/admin/ai-config").then((r) => r.json()).then(setAi);
    fetch("/api/admin/tenant").then((r) => r.json()).then(setTenant);
    fetch("/api/admin/portal-settings").then((r) => r.json()).then(setPortal);
  }, []);

  async function savePortal() {
    if (!portal) return;
    setSavingPortal(true);
    try {
      const res = await fetch("/api/admin/portal-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(portal),
      });
      if (res.ok) setPortal(await res.json());
    } finally {
      setSavingPortal(false);
    }
  }

  function addUsefulLink() {
    if (!portal) return;
    setPortal({
      ...portal,
      usefulLinks: [...portal.usefulLinks, { id: `link-${Date.now()}`, title: "", url: "" }],
    });
  }

  function updateUsefulLink(id: string, patch: Partial<UsefulLink>) {
    if (!portal) return;
    setPortal({ ...portal, usefulLinks: portal.usefulLinks.map((l) => (l.id === id ? { ...l, ...patch } : l)) });
  }

  function removeUsefulLink(id: string) {
    if (!portal) return;
    setPortal({ ...portal, usefulLinks: portal.usefulLinks.filter((l) => l.id !== id) });
  }

  async function saveAi() {
    if (!ai) return;
    setSavingAi(true);
    try {
      const res = await fetch("/api/admin/ai-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...ai, apiKey: apiKey || undefined }),
      });
      setAi(await res.json().then((d) => ({ ...ai, ...d })));
      setApiKey("");
    } finally {
      setSavingAi(false);
    }
  }

  async function saveTenant() {
    if (!tenant) return;
    setSavingTenant(true);
    try {
      await fetch("/api/admin/tenant", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tenant),
      });
    } finally {
      setSavingTenant(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-semibold text-slate-900">School details</h2>
        {tenant && (
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">School name</label>
              <input
                value={tenant.name}
                onChange={(e) => setTenant({ ...tenant, name: e.target.value })}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">DfE URN (optional)</label>
              <input
                value={tenant.urn ?? ""}
                onChange={(e) => setTenant({ ...tenant, urn: e.target.value })}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Brand colour</label>
              <input
                type="color"
                value={tenant.brandColor}
                onChange={(e) => setTenant({ ...tenant, brandColor: e.target.value })}
                className="mt-1 h-10 w-16 rounded-md border border-slate-300"
              />
            </div>
            <button
              onClick={saveTenant}
              disabled={savingTenant}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {savingTenant ? "Saving…" : "Save"}
            </button>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-semibold text-slate-900">AI assistance</h2>
        <p className="mt-1 text-sm text-slate-600">
          Choose the AI provider used for ticket triage and knowledge base suggestions. Leave the API key
          blank to use the platform&apos;s default key.
        </p>
        {ai && (
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Provider</label>
              <select
                value={ai.provider}
                onChange={(e) => setAi({ ...ai, provider: e.target.value as AiConfig["provider"] })}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="DISABLED">Disabled</option>
                <option value="CLAUDE">Claude (Anthropic)</option>
                <option value="GEMINI">Gemini (Google Vertex AI)</option>
              </select>
            </div>
            {ai.provider !== "DISABLED" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Model (optional override)</label>
                  <input
                    value={ai.model ?? ""}
                    onChange={(e) => setAi({ ...ai, model: e.target.value })}
                    placeholder={ai.provider === "CLAUDE" ? "claude-sonnet-4-5" : "gemini-2.5-flash"}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    School&apos;s own API key {ai.hasOwnApiKey && <span className="text-green-600">(set)</span>}
                  </label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Leave blank to use the platform default"
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={ai.ticketTriageEnabled}
                    onChange={(e) => setAi({ ...ai, ticketTriageEnabled: e.target.checked })}
                  />
                  Auto-triage new tickets
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={ai.kbSuggestionsEnabled}
                    onChange={(e) => setAi({ ...ai, kbSuggestionsEnabled: e.target.checked })}
                  />
                  Suggest knowledge base articles
                </label>
              </>
            )}
            <button
              onClick={saveAi}
              disabled={savingAi}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {savingAi ? "Saving…" : "Save"}
            </button>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-semibold text-slate-900">Self-service portal</h2>
        <p className="mt-1 text-sm text-slate-600">
          What staff see on their dashboard before raising a ticket.
        </p>
        {portal && (
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Hero title</label>
              <input
                value={portal.heroTitle}
                onChange={(e) => setPortal({ ...portal, heroTitle: e.target.value })}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Hero subtitle</label>
              <input
                value={portal.heroSubtitle}
                onChange={(e) => setPortal({ ...portal, heroSubtitle: e.target.value })}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(
                [
                  ["showQuickActions", "Quick actions"],
                  ["showPopularArticles", "Popular articles"],
                  ["showAnnouncements", "Announcements"],
                  ["showUrgentHelp", "Urgent help"],
                  ["showUsefulLinks", "Useful links"],
                  ["heroShowSearch", "Search box"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={portal[key]}
                    onChange={(e) => setPortal({ ...portal, [key]: e.target.checked })}
                  />
                  {label}
                </label>
              ))}
            </div>

            <div className="border-t border-slate-100 pt-4">
              <p className="text-sm font-medium text-slate-900">Urgent help block</p>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <input
                  value={portal.urgentHelpTitle}
                  onChange={(e) => setPortal({ ...portal, urgentHelpTitle: e.target.value })}
                  placeholder="Title"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  value={portal.urgentHelpAvailability}
                  onChange={(e) => setPortal({ ...portal, urgentHelpAvailability: e.target.value })}
                  placeholder="Availability text"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  value={portal.urgentHelpHotline}
                  onChange={(e) => setPortal({ ...portal, urgentHelpHotline: e.target.value })}
                  placeholder="Hotline number"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  value={portal.urgentHelpEmail}
                  onChange={(e) => setPortal({ ...portal, urgentHelpEmail: e.target.value })}
                  placeholder="Contact email"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                <textarea
                  value={portal.urgentHelpDescription}
                  onChange={(e) => setPortal({ ...portal, urgentHelpDescription: e.target.value })}
                  placeholder="Description"
                  rows={2}
                  className="col-span-2 rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-900">Useful links</p>
                <button onClick={addUsefulLink} className="text-sm text-blue-600 hover:underline">
                  + Add link
                </button>
              </div>
              <div className="mt-2 space-y-2">
                {portal.usefulLinks.map((link) => (
                  <div key={link.id} className="flex gap-2">
                    <input
                      value={link.title}
                      onChange={(e) => updateUsefulLink(link.id, { title: e.target.value })}
                      placeholder="Title"
                      className="w-1/3 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                    />
                    <input
                      value={link.url}
                      onChange={(e) => updateUsefulLink(link.id, { url: e.target.value })}
                      placeholder="https://…"
                      className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                    />
                    <button
                      onClick={() => removeUsefulLink(link.id)}
                      className="rounded-md border border-slate-200 px-2 text-sm text-slate-500 hover:bg-slate-50"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {portal.usefulLinks.length === 0 && <p className="text-sm text-slate-400">No links yet.</p>}
              </div>
            </div>

            <button
              onClick={savePortal}
              disabled={savingPortal}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {savingPortal ? "Saving…" : "Save"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
