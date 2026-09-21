"use client";

import { useEffect, useState } from "react";
import { TOGGLEABLE_NAV_ITEMS } from "@/components/portal-nav";

type AiConfig = {
  provider: "CLAUDE" | "GEMINI" | "DISABLED";
  model: string | null;
  hasOwnApiKey: boolean;
  ticketTriageEnabled: boolean;
  kbSuggestionsEnabled: boolean;
};
type Tenant = {
  name: string;
  logoUrl: string | null;
  brandColor: string;
  appName: string | null;
  sidebarColor: string | null;
  disabledNavItems: string[];
  urn: string | null;
  outOfHoursEnabled: boolean;
  outOfHoursStart: string;
  outOfHoursEnd: string;
  outOfHoursWeekendOnly: boolean;
  outOfHoursMessage: string;
};
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
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoNonce, setLogoNonce] = useState(0);
  const [tab, setTab] = useState<"organisation" | "hours" | "ai" | "portal">("organisation");

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

  async function uploadLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !tenant) return;
    setUploadingLogo(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/tenant/logo", { method: "POST", body: form });
      if (res.ok) {
        setTenant({ ...tenant, logoUrl: "set" });
        setLogoNonce((n) => n + 1);
      }
    } finally {
      setUploadingLogo(false);
      e.target.value = "";
    }
  }

  async function removeLogo() {
    if (!tenant) return;
    setUploadingLogo(true);
    try {
      await fetch("/api/admin/tenant/logo", { method: "DELETE" });
      setTenant({ ...tenant, logoUrl: null });
      setLogoNonce((n) => n + 1);
    } finally {
      setUploadingLogo(false);
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

  const TABS = [
    { key: "organisation", label: "Organisation" },
    { key: "hours", label: "Out of hours" },
    { key: "ai", label: "AI assistance" },
    { key: "portal", label: "Self-service portal" },
  ] as const;

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Settings</h1>
      <div className="mt-3 flex gap-1 rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === t.key ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300" : "text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <section className={`mt-6 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 ${tab === "organisation" ? "" : "hidden"}`}>
        <h2 className="font-semibold text-slate-900 dark:text-slate-100">Organisation details</h2>
        {tenant && (
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Organisation name</label>
              <input
                value={tenant.name}
                onChange={(e) => setTenant({ ...tenant, name: e.target.value })}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">DfE URN (optional)</label>
              <input
                value={tenant.urn ?? ""}
                onChange={(e) => setTenant({ ...tenant, urn: e.target.value })}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Logo</label>
              <div className="mt-1 flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                  {tenant.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- small admin-uploaded logo, not worth next/image's remote-loader setup
                    <img key={logoNonce} src={`/api/tenant/logo?v=${logoNonce}`} alt="Organisation logo" className="h-full w-full object-contain" />
                  ) : (
                    <span className="text-xs text-slate-500 dark:text-slate-500">None</span>
                  )}
                </div>
                <label className="cursor-pointer rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500">
                  {uploadingLogo ? "Uploading…" : "Upload"}
                  <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif" className="hidden" disabled={uploadingLogo} onChange={uploadLogo} />
                </label>
                {tenant.logoUrl && (
                  <button onClick={removeLogo} disabled={uploadingLogo} className="text-sm text-red-600 hover:underline disabled:opacity-50">
                    Remove
                  </button>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-700 dark:text-slate-300">Shown in the portal navigation sidebar. PNG, JPEG, SVG, WebP, or GIF, up to 2MB.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Brand colour</label>
              <input
                type="color"
                value={tenant.brandColor}
                onChange={(e) => setTenant({ ...tenant, brandColor: e.target.value })}
                className="mt-1 h-10 w-16 rounded-md border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
              />
            </div>
            <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">App name (optional)</label>
              <input
                value={tenant.appName ?? ""}
                onChange={(e) => setTenant({ ...tenant, appName: e.target.value })}
                placeholder="Novadesk"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
              />
              <p className="mt-1 text-xs text-slate-700 dark:text-slate-300">
                Replaces the &quot;Novadesk&quot; wordmark in the nav header — if you want to fully rebrand.
              </p>
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={Boolean(tenant.sidebarColor)}
                  onChange={(e) => setTenant({ ...tenant, sidebarColor: e.target.checked ? "#0f172a" : "" })}
                />
                Custom sidebar colour
              </label>
              {tenant.sidebarColor && (
                <input
                  type="color"
                  value={tenant.sidebarColor}
                  onChange={(e) => setTenant({ ...tenant, sidebarColor: e.target.value })}
                  className="mt-2 h-10 w-16 rounded-md border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
                />
              )}
            </div>
            <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Nav modules</p>
              <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">Hide modules you don&apos;t use from the staff sidebar.</p>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {TOGGLEABLE_NAV_ITEMS.map((item) => (
                  <label key={item.href} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={!tenant.disabledNavItems.includes(item.href)}
                      onChange={(e) =>
                        setTenant({
                          ...tenant,
                          disabledNavItems: e.target.checked
                            ? tenant.disabledNavItems.filter((h) => h !== item.href)
                            : [...tenant.disabledNavItems, item.href],
                        })
                      }
                    />
                    {item.label}
                  </label>
                ))}
              </div>
            </div>
            <button
              onClick={saveTenant}
              disabled={savingTenant}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {savingTenant ? "Saving…" : "Save"}
            </button>
          </div>
        )}
      </section>

      <section className={`mt-6 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 ${tab === "hours" ? "" : "hidden"}`}>
        <h2 className="font-semibold text-slate-900 dark:text-slate-100">Out-of-hours auto-notice</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Shown on tickets raised outside these hours (or on weekends, if selected) — also used to route tickets into the out-of-hours queue.</p>
        {tenant && (
          <div className="mt-4 space-y-4">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-slate-100">
              <input
                type="checkbox"
                checked={tenant.outOfHoursEnabled}
                onChange={(e) => setTenant({ ...tenant, outOfHoursEnabled: e.target.checked })}
              />
              Enable out-of-hours tracking
            </label>
            {tenant.outOfHoursEnabled && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
                  <div>
                    <label className="block text-xs text-slate-700 dark:text-slate-300">Starts</label>
                    <input
                      type="time"
                      value={tenant.outOfHoursStart}
                      onChange={(e) => setTenant({ ...tenant, outOfHoursStart: e.target.value })}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-700 dark:text-slate-300">Ends</label>
                    <input
                      type="time"
                      value={tenant.outOfHoursEnd}
                      onChange={(e) => setTenant({ ...tenant, outOfHoursEnd: e.target.value })}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={tenant.outOfHoursWeekendOnly}
                    onChange={(e) => setTenant({ ...tenant, outOfHoursWeekendOnly: e.target.checked })}
                  />
                  Weekends only (ignore the daily time window above)
                </label>
                <div className="sm:max-w-md">
                  <label className="block text-xs text-slate-700 dark:text-slate-300">Notice shown to the requester</label>
                  <textarea
                    value={tenant.outOfHoursMessage}
                    onChange={(e) => setTenant({ ...tenant, outOfHoursMessage: e.target.value })}
                    rows={2}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
                  />
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Manage bank/school holidays (also counted as out-of-hours) from{" "}
                  <a href="/portal/admin/holidays" className="text-indigo-600 hover:underline">
                    Admin → Holidays
                  </a>
                  .
                </p>
              </div>
            )}
            <button
              onClick={saveTenant}
              disabled={savingTenant}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {savingTenant ? "Saving…" : "Save"}
            </button>
          </div>
        )}
      </section>

      <section className={`mt-6 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 ${tab === "ai" ? "" : "hidden"}`}>
        <h2 className="font-semibold text-slate-900 dark:text-slate-100">AI assistance</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Choose the AI provider used for ticket triage and knowledge base suggestions. Leave the API key
          blank to use the platform&apos;s default key.
        </p>
        {ai && (
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Provider</label>
              <select
                value={ai.provider}
                onChange={(e) => setAi({ ...ai, provider: e.target.value as AiConfig["provider"] })}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
              >
                <option value="DISABLED">Disabled</option>
                <option value="CLAUDE">Claude (Anthropic)</option>
                <option value="GEMINI">Gemini (Google Vertex AI)</option>
              </select>
            </div>
            {ai.provider !== "DISABLED" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Model (optional override)</label>
                  <input
                    value={ai.model ?? ""}
                    onChange={(e) => setAi({ ...ai, model: e.target.value })}
                    placeholder={ai.provider === "CLAUDE" ? "claude-sonnet-4-5" : "gemini-2.5-flash"}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Your own API key {ai.hasOwnApiKey && <span className="text-green-600">(set)</span>}
                  </label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Leave blank to use the platform default"
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={ai.ticketTriageEnabled}
                    onChange={(e) => setAi({ ...ai, ticketTriageEnabled: e.target.checked })}
                  />
                  Auto-triage new tickets
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
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
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {savingAi ? "Saving…" : "Save"}
            </button>
          </div>
        )}
      </section>

      <section className={`mt-6 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 ${tab === "portal" ? "" : "hidden"}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">Self-service portal</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              What a User sees as their portal home, before raising a ticket. Technicians and admins never land
              here day-to-day — use the preview to check your changes.
            </p>
          </div>
          <a
            href="/portal/preview-home"
            target="_blank"
            rel="noreferrer"
            className="shrink-0 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Preview →
          </a>
        </div>
        {portal && (
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Hero title</label>
              <input
                value={portal.heroTitle}
                onChange={(e) => setPortal({ ...portal, heroTitle: e.target.value })}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Hero subtitle</label>
              <input
                value={portal.heroSubtitle}
                onChange={(e) => setPortal({ ...portal, heroSubtitle: e.target.value })}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
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
                <label key={key} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={portal[key]}
                    onChange={(e) => setPortal({ ...portal, [key]: e.target.checked })}
                  />
                  {label}
                </label>
              ))}
            </div>

            <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Urgent help block</p>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <input
                  value={portal.urgentHelpTitle}
                  onChange={(e) => setPortal({ ...portal, urgentHelpTitle: e.target.value })}
                  placeholder="Title"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
                />
                <input
                  value={portal.urgentHelpAvailability}
                  onChange={(e) => setPortal({ ...portal, urgentHelpAvailability: e.target.value })}
                  placeholder="Availability text"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
                />
                <input
                  value={portal.urgentHelpHotline}
                  onChange={(e) => setPortal({ ...portal, urgentHelpHotline: e.target.value })}
                  placeholder="Hotline number"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
                />
                <input
                  value={portal.urgentHelpEmail}
                  onChange={(e) => setPortal({ ...portal, urgentHelpEmail: e.target.value })}
                  placeholder="Contact email"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
                />
                <textarea
                  value={portal.urgentHelpDescription}
                  onChange={(e) => setPortal({ ...portal, urgentHelpDescription: e.target.value })}
                  placeholder="Description"
                  rows={2}
                  className="col-span-2 rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
                />
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Useful links</p>
                <button onClick={addUsefulLink} className="text-sm text-indigo-600 hover:underline">
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
                      className="w-1/3 rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
                    />
                    <input
                      value={link.url}
                      onChange={(e) => updateUsefulLink(link.id, { url: e.target.value })}
                      placeholder="https://…"
                      className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
                    />
                    <button
                      onClick={() => removeUsefulLink(link.id)}
                      className="rounded-md border border-slate-200 px-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {portal.usefulLinks.length === 0 && <p className="text-sm text-slate-600 dark:text-slate-400">No links yet.</p>}
              </div>
            </div>

            <button
              onClick={savePortal}
              disabled={savingPortal}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {savingPortal ? "Saving…" : "Save"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
