"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { isAdmin } from "@/lib/roles";

type Readiness = {
  totalPupils: number;
  pupilsWithIssues: number;
  issuesByField: Record<string, number>;
  pupils: { id: string; name: string; yearGroup: string; missingFields: string[] }[];
};

const FIELD_LABELS: Record<string, string> = {
  upn: "UPN",
  dob: "Date of birth",
  gender: "Gender",
  ethnicity: "Ethnicity",
  postcode: "Postcode",
  admissionDate: "Admission date",
};

export default function CensusPage() {
  const { data: session, status } = useSession();
  const [readiness, setReadiness] = useState<Readiness | null>(null);

  useEffect(() => {
    if (!session?.user || !isAdmin(session.user.role)) return;
    fetch("/api/census/readiness")
      .then((r) => r.json())
      .then(setReadiness);
  }, [session]);

  if (status === "loading") return <p className="text-sm text-slate-700">Loading…</p>;

  if (!session?.user || !isAdmin(session.user.role)) {
    return <p className="text-sm text-slate-700">This area is only available to school admins.</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Census readiness</h1>
        <a
          href="/api/census/export"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Download CSV export
        </a>
      </div>

      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        This is a data-readiness and export tool, not an official DfE school census submission. It helps you find
        missing or malformed pupil data and gives you a CSV starting point — your school still completes and
        submits its actual census return through DfE&apos;s COLLECT system.
      </div>

      {!readiness ? (
        <p className="mt-6 text-sm text-slate-700">Loading…</p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Active pupils" value={readiness.totalPupils} />
            <Stat
              label="Pupils with issues"
              value={readiness.pupilsWithIssues}
              highlight={readiness.pupilsWithIssues > 0}
            />
          </div>

          <div className="mt-8 rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-900">Issues by field</h2>
            <ul className="mt-4 space-y-2 text-sm">
              {Object.entries(readiness.issuesByField).map(([field, count]) => (
                <li key={field} className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-600">{FIELD_LABELS[field] ?? field}</span>
                  <span className={count > 0 ? "font-medium text-red-600" : "text-slate-700"}>{count}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-8 rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-900">Pupils with missing data</h2>
            {readiness.pupils.length === 0 ? (
              <p className="mt-4 text-sm text-slate-600">No issues found — every active pupil has these fields set.</p>
            ) : (
              <table className="mt-4 w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-600">
                    <th className="pb-2 font-medium">Pupil</th>
                    <th className="pb-2 font-medium">Year group</th>
                    <th className="pb-2 font-medium">Missing fields</th>
                  </tr>
                </thead>
                <tbody>
                  {readiness.pupils.map((p) => (
                    <tr key={p.id} className="border-t border-slate-100">
                      <td className="py-2">
                        <Link href={`/portal/pupils/${p.id}`} className="text-indigo-700 hover:underline">
                          {p.name}
                        </Link>
                      </td>
                      <td className="py-2 text-slate-700">{p.yearGroup.replace("YEAR_", "Year ").replace("_", " ")}</td>
                      <td className="py-2 text-slate-700">
                        {p.missingFields.map((f) => FIELD_LABELS[f] ?? f).join(", ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-700">{label}</p>
      <p className={`mt-1 text-3xl font-semibold ${highlight ? "text-red-600" : "text-slate-900"}`}>{value}</p>
    </div>
  );
}
