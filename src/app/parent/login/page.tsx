"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginError() {
  const params = useSearchParams();
  const error = params.get("error");
  if (!error) return null;
  return (
    <p className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
      Incorrect email or password. Please try again.
    </p>
  );
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn("parent-login", { email, password, callbackUrl: "/parent" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4 text-left">
      <div>
        <label className="block text-sm font-medium text-slate-700">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-indigo-600 px-4 py-2.5 font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export default function ParentLoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-slate-50 px-6 py-16">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 font-semibold text-white">
          N
        </div>
        <h1 className="text-xl font-semibold text-slate-900">Parent portal sign in</h1>
        <p className="mt-2 text-sm text-slate-600">
          Sign in with the email and password your school set up for you.
        </p>
        <Suspense fallback={null}>
          <LoginError />
        </Suspense>
        <LoginForm />
        <p className="mt-6 text-xs text-slate-600">
          Forgotten your password? Contact your school office to resend your invite.
        </p>
      </div>
    </div>
  );
}
