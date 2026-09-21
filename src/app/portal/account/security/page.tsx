"use client";

import { Suspense, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { User as UserIcon } from "lucide-react";

export default function AccountPage() {
  return (
    <Suspense fallback={null}>
      <AccountPageInner />
    </Suspense>
  );
}

type Profile = {
  name: string | null;
  email: string;
  jobTitle: string | null;
  phone: string | null;
  signature: string | null;
  image: string | null;
  avatarUrl: string | null;
};

function ProfileTab() {
  const { update } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [signature, setSignature] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarNonce, setAvatarNonce] = useState(0);

  function load() {
    fetch("/api/account/profile")
      .then((r) => r.json())
      .then((p: Profile) => {
        setProfile(p);
        setName(p.name ?? "");
        setJobTitle(p.jobTitle ?? "");
        setPhone(p.phone ?? "");
        setSignature(p.signature ?? "");
      });
  }
  useEffect(load, []);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          jobTitle: jobTitle || null,
          phone: phone || null,
          signature: signature || null,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setProfile((prev) => (prev ? { ...prev, ...updated } : prev));
        await update({ name: updated.name });
        // The nav bar's name comes from a Server Component prop (see
        // portal/layout.tsx) — update() alone only refreshes the client
        // session cache, so the nav needs an explicit refresh to catch up.
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  async function uploadAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/account/avatar", { method: "POST", body: form });
      if (res.ok) {
        setProfile((prev) => (prev ? { ...prev, avatarUrl: "set" } : prev));
        setAvatarNonce((n) => n + 1);
      }
    } finally {
      setUploadingAvatar(false);
      e.target.value = "";
    }
  }

  async function removeAvatar() {
    setUploadingAvatar(true);
    try {
      await fetch("/api/account/avatar", { method: "DELETE" });
      setProfile((prev) => (prev ? { ...prev, avatarUrl: null } : prev));
      setAvatarNonce((n) => n + 1);
    } finally {
      setUploadingAvatar(false);
    }
  }

  if (!profile) return <p className="text-sm text-slate-700 dark:text-slate-300">Loading…</p>;

  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="font-semibold text-slate-900 dark:text-slate-100">Profile</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Shown to other staff and used on your ticket replies.
      </p>

      <div className="mt-4 flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800">
          {profile.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- self-uploaded avatar, not worth next/image's remote-loader setup
            <img key={avatarNonce} src={`/api/account/avatar?v=${avatarNonce}`} alt="" className="h-full w-full object-cover" />
          ) : profile.image ? (
            // eslint-disable-next-line @next/next/no-img-element -- Google-provided avatar URL, already remote
            <img src={profile.image} alt="" className="h-full w-full object-cover" />
          ) : (
            <UserIcon size={24} className="text-slate-400 dark:text-slate-500" />
          )}
        </div>
        <div>
          <label className="cursor-pointer rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800">
            {uploadingAvatar ? "Uploading…" : "Upload photo"}
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" disabled={uploadingAvatar} onChange={uploadAvatar} />
          </label>
          {profile.avatarUrl && (
            <button onClick={removeAvatar} disabled={uploadingAvatar} className="ml-3 text-sm text-red-600 hover:underline disabled:opacity-50">
              Remove
            </button>
          )}
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">PNG, JPEG, WebP, or GIF, up to 2MB.</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="profile-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Full name</label>
          <input
            id="profile-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
          />
        </div>
        <div>
          <label htmlFor="profile-email" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
          <input
            id="profile-email"
            value={profile.email}
            disabled
            className="mt-1 w-full cursor-not-allowed rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-500"
          />
        </div>
        <div>
          <label htmlFor="profile-job-title" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Job title</label>
          <input
            id="profile-job-title"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            placeholder="e.g. IT Support Technician"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
          />
        </div>
        <div>
          <label htmlFor="profile-phone" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Phone (optional)</label>
          <input
            id="profile-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
          />
        </div>
      </div>

      <div className="mt-4">
        <label htmlFor="profile-signature" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Email signature (optional)</label>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
          Plain text — insert it into a ticket reply with the &quot;Insert signature&quot; button.
        </p>
        <textarea
          id="profile-signature"
          value={signature}
          onChange={(e) => setSignature(e.target.value)}
          rows={4}
          placeholder={"Thanks,\nDamien\nIT Support"}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
        />
      </div>

      <button
        onClick={save}
        disabled={saving || !name.trim()}
        className="mt-4 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </section>
  );
}

function SecurityTab() {
  const { data: session, update } = useSession();
  const searchParams = useSearchParams();
  const mandatorySetup = searchParams.get("setup2fa") === "1";

  const [step, setStep] = useState<"idle" | "setup" | "confirm" | "done">("idle");
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const enabled = session?.user.twoFactorEnabled;
  const isStaff = session?.user.role && session.user.role !== "REQUESTER";

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
    await update({ twoFactorEnabled: true, twoFactorVerified: true });
  }

  async function disable() {
    if (!confirm("Turn off two-factor authentication for your account?")) return;
    await fetch("/api/auth/2fa/disable", { method: "POST" });
    setStep("idle");
    setRecoveryCodes(null);
    await update({ twoFactorEnabled: false, twoFactorVerified: true });
  }

  return (
    <>
      {mandatorySetup && !enabled && (
        <div className="mt-4 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          Two-factor authentication is required for your role before you can access the rest of the portal.
          Set it up below to continue.
        </div>
      )}

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">Two-factor authentication</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {enabled
                ? "Enabled — required at every sign-in."
                : isStaff
                  ? "Required for your role — add an authenticator app as a second factor."
                  : "Add an authenticator app as a second factor."}
            </p>
          </div>
          {enabled ? (
            !isStaff && (
              <button onClick={disable} className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950">
                Turn off
              </button>
            )
          ) : (
            step === "idle" && (
              <button onClick={beginSetup} className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700">
                Set up
              </button>
            )
          )}
        </div>

        {step === "confirm" && qrCodeDataUrl && (
          <div className="mt-6 border-t border-slate-100 pt-6 dark:border-slate-800">
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Scan this with Google Authenticator (or any TOTP app), then enter the 6-digit code.
            </p>
            <Image src={qrCodeDataUrl} alt="2FA QR code" width={180} height={180} className="mt-3 rounded-md border border-slate-200 dark:border-slate-800" unoptimized />
            <p className="mt-2 font-mono text-xs text-slate-600 dark:text-slate-400">Manual entry key: {secret}</p>
            <form onSubmit={confirmSetup} className="mt-4 flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.trim())}
                placeholder="123456"
                className="w-32 rounded-md border border-slate-300 px-3 py-2 text-center tracking-widest dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
              />
              <button type="submit" className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                Confirm
              </button>
            </form>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          </div>
        )}

        {step === "done" && recoveryCodes && (
          <div className="mt-6 border-t border-slate-100 pt-6 dark:border-slate-800">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Save your recovery codes</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Each can be used once if you lose access to your authenticator app. They won&apos;t be shown again.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 rounded-md bg-slate-50 p-4 font-mono text-sm dark:bg-slate-800">
              {recoveryCodes.map((c) => (
                <span key={c}>{c}</span>
              ))}
            </div>
          </div>
        )}
      </section>
    </>
  );
}

function AccountPageInner() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const mandatorySetup = searchParams.get("setup2fa") === "1";
  const [tab, setTab] = useState<"profile" | "security">(mandatorySetup ? "security" : "profile");

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">My account</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Signed in as {session?.user.email}</p>

      <div className="mt-4 flex gap-1 rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
        <button
          onClick={() => setTab("profile")}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === "profile" ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300" : "text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"}`}
        >
          Profile
        </button>
        <button
          onClick={() => setTab("security")}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === "security" ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300" : "text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"}`}
        >
          Security
        </button>
      </div>

      {tab === "profile" ? <ProfileTab /> : <SecurityTab />}
    </div>
  );
}
