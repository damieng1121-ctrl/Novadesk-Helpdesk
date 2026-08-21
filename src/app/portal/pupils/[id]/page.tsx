import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/roles";
import { canAccessMis } from "@/lib/roles";
import { isAttendedSession, PERSISTENT_ABSENCE_THRESHOLD } from "@/lib/attendance-codes";
import type { YearGroup } from "@prisma/client";

function yearGroupLabel(yg: YearGroup): string {
  if (yg === "NURSERY") return "Nursery";
  if (yg === "RECEPTION") return "Reception";
  return `Year ${yg.replace("YEAR_", "")}`;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const SEND_STYLES: Record<string, string> = {
  SEND_SUPPORT: "bg-amber-100 text-amber-700",
  EHCP: "bg-purple-100 text-purple-700",
};

export default async function PupilProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.tenantId || !canAccessMis(session.user.role, session.user.isTeacher)) {
    notFound();
  }
  const tenantId = session.user.tenantId;
  const viewerIsAdmin = isAdmin(session.user.role);

  const pupil = await prisma.pupil.findUnique({
    where: { id },
    include: { formGroup: { select: { id: true, name: true, academicYearId: true } } },
  });
  if (!pupil || pupil.tenantId !== tenantId || pupil.isDeleted) notFound();

  const currentYear = await prisma.academicYear.findFirst({
    where: { tenantId, isCurrent: true },
  });
  const yearForStats = currentYear ?? (await prisma.academicYear.findFirst({ where: { tenantId }, orderBy: { startDate: "desc" } }));

  const [attendanceRecords, behaviourIncidents, sendPlan, assessmentResults, interventions] = await Promise.all([
    yearForStats
      ? prisma.attendanceRecord.findMany({
          where: { tenantId, pupilId: id, date: { gte: yearForStats.startDate, lte: yearForStats.endDate } },
          select: { mark: true },
        })
      : Promise.resolve([]),
    prisma.behaviourIncident.findMany({
      where: {
        tenantId,
        pupilId: id,
        ...(viewerIsAdmin ? {} : { isConfidential: false }),
      },
      orderBy: { date: "desc" },
      take: 10,
      include: { recordedBy: { select: { name: true, email: true } } },
    }),
    pupil.sendStatus !== "NONE"
      ? prisma.sendPlan.findFirst({ where: { tenantId, pupilId: id }, orderBy: { updatedAt: "desc" } })
      : Promise.resolve(null),
    prisma.assessmentResult.findMany({
      where: { tenantId, pupilId: id },
      orderBy: { date: "desc" },
      take: 10,
      include: { subject: { select: { name: true } } },
    }),
    prisma.intervention.findMany({
      where: { tenantId, pupilId: id, status: { in: ["PLANNED", "ACTIVE"] } },
      orderBy: { startDate: "desc" },
      include: { provider: { select: { name: true, email: true } } },
    }),
  ]);

  const recordedSessions = attendanceRecords.filter((r) => r.mark !== "NOT_RECORDED");
  const attendedSessions = recordedSessions.filter((r) => isAttendedSession(r.mark));
  const attendancePct = recordedSessions.length ? attendedSessions.length / recordedSessions.length : null;
  const isPersistentAbsence = attendancePct !== null && attendancePct < PERSISTENT_ABSENCE_THRESHOLD;

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            {pupil.preferredName || pupil.firstName} {pupil.lastName}
          </h1>
          <p className="mt-1 text-sm text-slate-700">
            DOB {formatDate(pupil.dob)} &middot; {yearGroupLabel(pupil.yearGroup)}
            {pupil.formGroup ? ` · ${pupil.formGroup.name}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          {pupil.sendStatus !== "NONE" && (
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${SEND_STYLES[pupil.sendStatus]}`}>
              {pupil.sendStatus === "SEND_SUPPORT" ? "SEND Support" : "EHCP"}
            </span>
          )}
          {pupil.pupilPremium && <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">Pupil Premium</span>}
          {pupil.freeSchoolMeals && <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">FSM</span>}
          {!pupil.isActive && <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-700">Inactive</span>}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-600">Attendance {yearForStats ? `(${yearForStats.name})` : ""}</p>
          <p className="mt-1 text-3xl font-semibold text-slate-900">
            {attendancePct === null ? "—" : `${(attendancePct * 100).toFixed(1)}%`}
          </p>
          <p className="mt-1 text-xs text-slate-600">{recordedSessions.length} sessions recorded</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-600">UPN</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{pupil.upn ?? "Not allocated"}</p>
          <p className="mt-1 text-xs text-slate-600">Admission no. {pupil.admissionNumber ?? "—"}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-600">Guardians</p>
          <Link href={`/portal/pupils/${pupil.id}/guardians`} className="mt-1 inline-block text-sm text-indigo-600 hover:underline">
            View / manage guardians &rarr;
          </Link>
        </div>
      </div>

      {isPersistentAbsence && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <strong>Persistent absence:</strong> attendance is below the {(PERSISTENT_ABSENCE_THRESHOLD * 100).toFixed(0)}% DfE threshold.
        </div>
      )}

      {pupil.sendStatus !== "NONE" && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">SEND plan</h2>
          {sendPlan ? (
            <div className="mt-2 text-sm text-slate-700">
              <p><span className="font-medium">Primary need:</span> {sendPlan.primaryNeed ?? "Not specified"}</p>
              <p className="mt-2 whitespace-pre-wrap">{sendPlan.description}</p>
              {sendPlan.reviewDate && <p className="mt-2 text-xs text-slate-600">Next review: {formatDate(sendPlan.reviewDate)}</p>}
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-700">No SEND plan on file yet.</p>
          )}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">Recent behaviour incidents</h2>
          {behaviourIncidents.length === 0 ? (
            <p className="mt-2 text-sm text-slate-700">No incidents recorded.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {behaviourIncidents.map((b) => (
                <li key={b.id} className="py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-900">{b.category.replaceAll("_", " ")}</span>
                    <span className="text-xs text-slate-600">{formatDate(b.date)}</span>
                  </div>
                  <p className="mt-0.5 text-slate-700">{b.description}</p>
                  {b.points !== 0 && <p className="mt-0.5 text-xs text-slate-600">{b.points > 0 ? "+" : ""}{b.points} points</p>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">Recent assessment results</h2>
          {assessmentResults.length === 0 ? (
            <p className="mt-2 text-sm text-slate-700">No assessment results yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {assessmentResults.map((a) => (
                <li key={a.id} className="py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-900">{a.subject.name}</span>
                    <span className="text-xs text-slate-600">{a.term}</span>
                  </div>
                  <p className="mt-0.5 text-slate-700">{a.attainment}{a.effort ? ` · Effort: ${a.effort}` : ""}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">Active interventions</h2>
        {interventions.length === 0 ? (
          <p className="mt-2 text-sm text-slate-700">No active interventions.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {interventions.map((i) => (
              <li key={i.id} className="py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-900">{i.title}</span>
                  <span className="text-xs text-slate-600">{i.status}</span>
                </div>
                <p className="mt-0.5 text-xs text-slate-600">
                  Led by {i.provider.name ?? i.provider.email} &middot; started {formatDate(i.startDate)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
