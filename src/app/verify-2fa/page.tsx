"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function Verify2faPage() {
  const { update } = useSession();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: code }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Verification failed");
        return;
      }
      await update({ twoFactorVerified: true });
      router.replace("/portal");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-slate-50 px-6 py-16">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Two-factor verification</h1>
        <p className="mt-2 text-sm text-slate-600">
          Enter the 6-digit code from your authenticator app, or a recovery code.
        </p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <input
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.trim())}
            placeholder="123456"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-center text-lg tracking-widest focus:border-indigo-500 focus:outline-none"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting || code.length < 6}
            className="w-full rounded-md bg-indigo-600 px-4 py-2.5 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? "Verifying…" : "Verify"}
          </button>
        </form>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="mt-4 w-full text-center text-sm text-slate-700 hover:text-slate-900"
        >
          Sign in with a different account
        </button>
      </div>
    </div>
  );
}
