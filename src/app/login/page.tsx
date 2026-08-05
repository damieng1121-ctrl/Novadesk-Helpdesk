"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginError() {
  const params = useSearchParams();
  const error = params.get("error");
  if (!error) return null;
  return (
    <p className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
      {error === "AccessDenied"
        ? "Your Google account's domain isn't registered to a Novadesk school yet. Ask your school's IT admin to set this up, or contact us."
        : "Something went wrong signing you in. Please try again."}
    </p>
  );
}

// Mirrors the server-side gate in src/lib/auth.ts — the "dev-login" provider
// only exists in the providers array outside a production build, so this is
// purely a UI convenience, not the actual security boundary.
const DEV_LOGIN_ENABLED = process.env.NODE_ENV !== "production";

const DEV_ACCOUNTS = [
  { email: "superadmin@novadesk.dev", label: "Novadesk Platform — Super Admin" },
  { email: "admin@willowbrook-primary.sch.uk", label: "Priya Shah — Tenant Admin" },
  { email: "it-support@willowbrook-primary.sch.uk", label: "Sam Okafor — Agent" },
  { email: "j.taylor@willowbrook-primary.sch.uk", label: "Jamie Taylor — Requester" },
];

function DevLogin() {
  if (!DEV_LOGIN_ENABLED) return null;
  return (
    <div className="mt-6 border-t border-slate-200 pt-6 text-left">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-600">
        Dev login (local only — no Google OAuth needed)
      </p>
      <p className="mt-1 text-xs text-slate-700">
        Requires the seed script to have run. Admin/Agent will still be prompted to set up 2FA —
        that part of the real flow isn&apos;t skipped.
      </p>
      <div className="mt-3 space-y-2">
        {DEV_ACCOUNTS.map((a) => (
          <button
            key={a.email}
            onClick={() => signIn("dev-login", { email: a.email, callbackUrl: "/portal" })}
            className="block w-full rounded-md border border-slate-200 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
          >
            {a.label}
            <span className="block text-xs text-slate-600">{a.email}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-slate-50 px-6 py-16">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 font-semibold text-white">
          N
        </div>
        <h1 className="text-xl font-semibold text-slate-900">Sign in to Novadesk</h1>
        <p className="mt-2 text-sm text-slate-600">
          Use your school&apos;s Google Workspace account. Admins and agents will also be asked for a
          second factor.
        </p>
        <button
          onClick={() => signIn("google", { callbackUrl: "/portal" })}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50"
        >
          <GoogleIcon />
          Sign in with Google
        </button>
        <Suspense fallback={null}>
          <LoginError />
        </Suspense>
        <DevLogin />
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.95v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.95 10.7A5.4 5.4 0 0 1 3.66 9c0-.59.1-1.17.29-1.7V4.97H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.95 4.03l3-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .95 4.97l3 2.33C4.66 5.17 6.65 3.58 9 3.58z"
      />
    </svg>
  );
}
