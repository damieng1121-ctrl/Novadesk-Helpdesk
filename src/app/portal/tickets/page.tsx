"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { StatusBadge, PriorityBadge } from "@/components/badges";
import { isOverdue } from "@/lib/sla";

type Ticket = {
  id: string;
  number: number;
  subject: string;
  status: string;
  priority: string;
  createdAt: string;
  dueAt: string | null;
  category: { name: string } | null;
  brand: { id: string; name: string } | null;
  company: { id: string; name: string } | null;
  isOutOfHours: boolean;
  requester: { name: string | null; email: string | null };
  assignee: { name: string | null; email: string | null } | null;
};

type Brand = { id: string; name: string };
type Company = { id: string; name: string };

export default function TicketsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-700 dark:text-slate-300">Loading…</p>}>
      <TicketsList />
    </Suspense>
  );
}

function TicketsList() {
  const searchParams = useSearchParams();
  const assignee = searchParams.get("assignee");
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [status, setStatus] = useState("");
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandId, setBrandId] = useState("");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [outOfHoursOnly, setOutOfHoursOnly] = useState(false);

  useEffect(() => {
    fetch("/api/brands")
      .then((r) => r.json())
      .then(setBrands);
    fetch("/api/admin/companies")
      .then((r) => r.json())
      .then(setCompanies);
  }, []);

  useEffect(() => {
    const qs = new URLSearchParams();
    if (assignee) qs.set("assignee", assignee);
    if (status) qs.set("status", status);
    if (brandId) qs.set("brandId", brandId);
    if (companyId) qs.set("companyId", companyId);
    if (outOfHoursOnly) qs.set("outOfHours", "true");
    fetch(`/api/tickets?${qs.toString()}`)
      .then((r) => r.json())
      .then(setTickets);
  }, [assignee, status, brandId, companyId, outOfHoursOnly]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Tickets</h1>
        <Link
          href="/portal/tickets/new"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Raise a ticket
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {[
          { value: "", label: "All" },
          { value: "OPEN", label: "Open" },
          { value: "IN_PROGRESS", label: "In progress" },
          { value: "ON_HOLD", label: "Pending" },
          { value: "RESOLVED", label: "Resolved" },
          { value: "CLOSED", label: "Closed" },
        ].map((s) => (
          <button
            key={s.value}
            onClick={() => setStatus(s.value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              status === s.value
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
            } border border-slate-200 dark:border-slate-800`}
          >
            {s.label}
          </button>
        ))}
        <button
          onClick={() => setOutOfHoursOnly((v) => !v)}
          className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
            outOfHoursOnly
              ? "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
          }`}
        >
          Out of hours only
        </button>
        {brands.length > 1 && (
          <select
            value={brandId}
            onChange={(e) => setBrandId(e.target.value)}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-400"
          >
            <option value="">All brands</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        )}
        {companies.length > 1 && (
          <select
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-400"
          >
            <option value="">All companies</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {tickets === null && <p className="p-6 text-sm text-slate-700 dark:text-slate-300">Loading…</p>}
        {tickets?.length === 0 && <p className="p-6 text-sm text-slate-700 dark:text-slate-300">No tickets found.</p>}
        <table className="w-full text-left text-sm">
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {tickets?.map((t) => (
              <tr key={t.id}>
                <td className="p-4">
                  <Link href={`/portal/tickets/${t.id}`} className="font-medium text-slate-900 hover:text-indigo-600 dark:text-slate-100">
                    #{t.number} {t.subject}
                  </Link>
                  <p className="mt-0.5 text-xs text-slate-700 dark:text-slate-300">
                    {t.category?.name ?? "Uncategorised"} · {t.requester.name ?? t.requester.email}
                    {t.brand && <> · {t.brand.name}</>}
                    {t.company && <> · {t.company.name}</>}
                  </p>
                </td>
                <td className="p-4">
                  <PriorityBadge priority={t.priority as never} />
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={t.status as never} />
                    {isOverdue(t.dueAt, t.status) && (
                      <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:text-red-400 dark:bg-red-950">
                        Overdue
                      </span>
                    )}
                    {t.isOutOfHours && (
                      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-300 dark:bg-amber-950">
                        Out of hours
                      </span>
                    )}
                  </div>
                </td>
                <td className="p-4 text-slate-700 dark:text-slate-300">{t.assignee?.name ?? "Unassigned"}</td>
                <td className="p-4 text-slate-600 dark:text-slate-400">{new Date(t.createdAt).toLocaleDateString("en-GB")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
