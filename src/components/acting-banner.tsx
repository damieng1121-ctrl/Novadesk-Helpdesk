"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export function ActingBanner({ tenantName }: { tenantName: string }) {
  const { update } = useSession();
  const router = useRouter();
  const [exiting, setExiting] = useState(false);

  async function exit() {
    setExiting(true);
    try {
      await update({ actingTenantId: null });
      router.push("/portal/super-admin");
      router.refresh();
    } finally {
      setExiting(false);
    }
  }

  return (
    <div className="flex items-center justify-between border-b border-amber-200 bg-amber-50 px-6 py-2 text-sm text-amber-900">
      <span>
        You&apos;re managing <strong>{tenantName}</strong> as a Novadesk platform admin.
      </span>
      <button onClick={exit} disabled={exiting} className="font-medium underline hover:no-underline disabled:opacity-50">
        {exiting ? "Exiting…" : "Exit to platform admin"}
      </button>
    </div>
  );
}
