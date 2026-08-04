"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import Image from "next/image";

export default function SecurityPage() {
  const { data: session, update } = useSession();
  const [step, setStep] = useState<"idle" | "setup" | "confirm" | "done">("idle");
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const enabled = session?.user.twoFactorEnabled;

  async function beginSetup() {
    setError(null);
    const res = await fetch("/api/auth/2fa/setup", { method: "POST" });
    const data = await res.json();
    setQrCodeDataUrl(data.qrCodeDataUrl);
    setSecret(data.secret);
    setStep("confirm");
  }

  async function confirmSetup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/auth/2fa/enable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: code }),
    });
    const data = await res.json();
    if (!data.ok) {
      setError(data.error ?? "Invalid code");
      return;
    }
    setRecoveryCodes(data.recoveryCodes);
    setStep("done");
    await update({ twoFactorVerified: true });
  }

  async function disable() {
    if (!confirm("Turn off two-factor authentication for your account?")) return;
    await fetch("/api/auth/2fa/disable", { method: "POST" });
    setStep("idle");
    setRecoveryCodes(null);
    window.location.reload();
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold text-slate-900">Account security</h1>
      <p className="mt-1 text-sm text-slate-600">Signed in as {session?.user.email}</p>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">Two-factor authentication</h2>
            <p className="mt-1 text-sm text-slate-600">
              {enabled ? "Enabled — required at every sign-in." : "Add an authenticator app as a second factor."}
            </p>
          </div>
          {enabled ? (
            <button onClick={disable} className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50">
              Turn off
            </button>
          ) : (
            step === "idle" && (
              <button onClick={beginSetup} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
                Set up
              </button>
            )
          )}
        </div>

        {step === "confirm" && qrCodeDataUrl && (
          <div className="mt-6 border-t border-slate-100 pt-6">
            <p className="text-sm text-slate-700">
              Scan this with Google Authenticator (or any TOTP app), then enter the 6-digit code.
            </p>
            <Image src={qrCodeDataUrl} alt="2FA QR code" width={180} height={180} className="mt-3 rounded-md border border-slate-200" unoptimized />
            <p className="mt-2 font-mono text-xs text-slate-400">Manual entry key: {secret}</p>
            <form onSubmit={confirmSetup} className="mt-4 flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.trim())}
                placeholder="123456"
                className="w-32 rounded-md border border-slate-300 px-3 py-2 text-center tracking-widest"
              />
              <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                Confirm
              </button>
            </form>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          </div>
        )}

        {step === "done" && recoveryCodes && (
          <div className="mt-6 border-t border-slate-100 pt-6">
            <p className="text-sm font-medium text-slate-900">Save your recovery codes</p>
            <p className="mt-1 text-sm text-slate-600">
              Each can be used once if you lose access to your authenticator app. They won&apos;t be shown again.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 rounded-md bg-slate-50 p-4 font-mono text-sm">
              {recoveryCodes.map((c) => (
                <span key={c}>{c}</span>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
