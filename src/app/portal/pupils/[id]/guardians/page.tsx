"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Relationship = "MOTHER" | "FATHER" | "GUARDIAN" | "GRANDPARENT" | "CARER" | "OTHER";

type GuardianLink = {
  id: string;
  guardianId: string;
  relationship: Relationship;
  parentalResponsibility: boolean;
  isPrimaryContact: boolean;
  isEmergencyContact: boolean;
  canCollect: boolean;
  guardian: { id: string; name: string | null; email: string | null; phone: string | null };
};

const RELATIONSHIP_LABELS: Record<Relationship, string> = {
  MOTHER: "Mother",
  FATHER: "Father",
  GUARDIAN: "Guardian",
  GRANDPARENT: "Grandparent",
  CARER: "Carer",
  OTHER: "Other",
};

export default function PupilGuardiansPage() {
  const params = useParams<{ id: string }>();
  const pupilId = params.id;

  const [links, setLinks] = useState<GuardianLink[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [relationship, setRelationship] = useState<Relationship>("MOTHER");
  const [parentalResponsibility, setParentalResponsibility] = useState(true);
  const [isPrimaryContact, setIsPrimaryContact] = useState(false);
  const [isEmergencyContact, setIsEmergencyContact] = useState(true);
  const [canCollect, setCanCollect] = useState(true);

  function load() {
    fetch(`/api/pupils/${pupilId}/guardians`)
      .then((r) => r.json())
      .then(setLinks);
  }
  useEffect(load, [pupilId]);

  async function addGuardian(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/pupils/${pupilId}/guardians`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          firstName,
          lastName,
          relationship,
          parentalResponsibility,
          isPrimaryContact,
          isEmergencyContact,
          canCollect,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      setEmail("");
      setFirstName("");
      setLastName("");
      setRelationship("MOTHER");
      setParentalResponsibility(true);
      setIsPrimaryContact(false);
      setIsEmergencyContact(true);
      setCanCollect(true);
      setShowForm(false);
      load();
    } finally {
      setSubmitting(false);
    }
  }

  async function unlink(guardianId: string) {
    if (!confirm("Unlink this guardian from the pupil? Their account itself won't be deleted.")) return;
    await fetch(`/api/pupils/${pupilId}/guardians/${guardianId}`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Parents &amp; guardians</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          {showForm ? "Cancel" : "Add guardian"}
        </button>
      </div>
      <p className="mt-1 text-sm text-slate-700">
        Linked guardians can sign in to the parent portal to see this pupil&apos;s attendance, behaviour, and messages.
      </p>

      {showForm && (
        <form onSubmit={addGuardian} className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <select value={relationship} onChange={(e) => setRelationship(e.target.value as Relationship)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            {(Object.keys(RELATIONSHIP_LABELS) as Relationship[]).map((r) => (
              <option key={r} value={r}>{RELATIONSHIP_LABELS[r]}</option>
            ))}
          </select>
          <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input required value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <div className="flex flex-wrap gap-4 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={parentalResponsibility} onChange={(e) => setParentalResponsibility(e.target.checked)} />
              Parental responsibility
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={isPrimaryContact} onChange={(e) => setIsPrimaryContact(e.target.checked)} />
              Primary contact
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={isEmergencyContact} onChange={(e) => setIsEmergencyContact(e.target.checked)} />
              Emergency contact
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={canCollect} onChange={(e) => setCanCollect(e.target.checked)} />
              Can collect pupil
            </label>
          </div>
          {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
          <p className="text-xs text-slate-600 sm:col-span-2">
            If no account exists for this email, one will be created and an invite emailed to set a password.
          </p>
          <button type="submit" disabled={submitting} className="sm:col-span-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
            {submitting ? "Adding…" : "Add guardian"}
          </button>
        </form>
      )}

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="p-4">Name</th>
              <th className="p-4">Relationship</th>
              <th className="p-4">Flags</th>
              <th className="p-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {links?.map((l) => (
              <tr key={l.id}>
                <td className="p-4">
                  <p className="font-medium text-slate-900">{l.guardian.name ?? "—"}</p>
                  <p className="text-xs text-slate-700">{l.guardian.email}</p>
                </td>
                <td className="p-4 text-slate-600">{RELATIONSHIP_LABELS[l.relationship]}</td>
                <td className="p-4 text-slate-600">
                  <div className="flex flex-wrap gap-1">
                    {l.parentalResponsibility && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">PR</span>}
                    {l.isPrimaryContact && <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700">Primary</span>}
                    {l.isEmergencyContact && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">Emergency</span>}
                    {l.canCollect && <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Can collect</span>}
                  </div>
                </td>
                <td className="p-4">
                  <button onClick={() => unlink(l.guardianId)} className="text-xs text-red-600 hover:underline">
                    Unlink
                  </button>
                </td>
              </tr>
            ))}
            {links?.length === 0 && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-sm text-slate-700">No guardians linked yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
