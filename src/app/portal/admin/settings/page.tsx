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

export default function AdminSettingsPage() {
  const [ai, setAi] = useState<AiConfig | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [savingAi, setSavingAi] = useState(false);
  const [savingTenant, setSavingTenant] = useState(false);

  useEffect(() => {
    fetch("/api/admin/ai-config").then((r) => r.json()).then(setAi);
    fetch("/api/admin/tenant").then((r) => r.json()).then(setTenant);
  }, []);

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
    </div>
  );
}
