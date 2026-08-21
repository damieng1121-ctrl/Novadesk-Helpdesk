import { requireMisSession } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { isAttendedSession, PERSISTENT_ABSENCE_THRESHOLD } from "@/lib/attendance-codes";

const BEHAVIOUR_CATEGORIES = ["ACHIEVEMENT", "CONCERN", "BULLYING", "SAFEGUARDING"] as const;

/** Monday 00:00 UTC of the ISO week containing `d` — used to bucket attendance records into weekly trend points. */
function isoWeekStart(d: Date): Date {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7;
  if (day !== 1) date.setUTCDate(date.getUTCDate() - (day - 1));
  return date;
}

function formatWeekLabel(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

export async function GET(req: Request) {
  return withApiErrors(async () => {
    const session = await requireMisSession();
    const tenantId = session.user.tenantId;
    const subjectId = new URL(req.url).searchParams.get("subjectId");

    const trendWindowStart = isoWeekStart(new Date());
    trendWindowStart.setUTCDate(trendWindowStart.getUTCDate() - 7 * 7);

    const [trendRecords, pupilsWithAttendance, behaviourByCategory, assessmentByAttainment, subjects] =
      await Promise.all([
        prisma.attendanceRecord.findMany({
          where: { tenantId, date: { gte: trendWindowStart }, mark: { not: "NOT_RECORDED" } },
          select: { date: true, mark: true },
        }),
        prisma.pupil.findMany({
          where: { tenantId, isActive: true, isDeleted: false },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            attendanceRecords: { where: { mark: { not: "NOT_RECORDED" } }, select: { mark: true } },
          },
        }),
        prisma.behaviourIncident.groupBy({ by: ["category"], where: { tenantId }, _sum: { points: true } }),
        prisma.assessmentResult.groupBy({
          by: ["attainment"],
          where: { tenantId, ...(subjectId ? { subjectId } : {}) },
          _count: true,
        }),
        prisma.assessmentSubject.findMany({
          where: { tenantId },
          select: { id: true, name: true },
          orderBy: { order: "asc" },
        }),
      ]);

    const weekBuckets = new Map<string, { weekStart: Date; attended: number; total: number }>();
    for (const r of trendRecords) {
      const weekStart = isoWeekStart(r.date);
      const key = weekStart.toISOString().slice(0, 10);
      const bucket = weekBuckets.get(key) ?? { weekStart, attended: 0, total: 0 };
      bucket.total += 1;
      if (isAttendedSession(r.mark)) bucket.attended += 1;
      weekBuckets.set(key, bucket);
    }
    const attendanceTrend = Array.from(weekBuckets.values())
      .sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime())
      .map((b) => ({
        week: formatWeekLabel(b.weekStart),
        attendancePct: b.total ? Math.round((b.attended / b.total) * 1000) / 10 : 0,
      }));

    const persistentAbsence = pupilsWithAttendance
      .map((p) => {
        const total = p.attendanceRecords.length;
        const attended = p.attendanceRecords.filter((r) => isAttendedSession(r.mark)).length;
        return {
          id: p.id,
          name: `${p.firstName} ${p.lastName}`,
          totalSessions: total,
          attendancePct: total ? Math.round((attended / total) * 1000) / 10 : null,
        };
      })
      .filter((p) => p.attendancePct !== null && p.attendancePct / 100 < PERSISTENT_ABSENCE_THRESHOLD)
      .sort((a, b) => (a.attendancePct ?? 0) - (b.attendancePct ?? 0));

    const behaviourPoints = BEHAVIOUR_CATEGORIES.map((category) => ({
      category,
      points: behaviourByCategory.find((b) => b.category === category)?._sum.points ?? 0,
    }));

    const assessmentDistribution = assessmentByAttainment.map((a) => ({
      attainment: a.attainment,
      count: a._count,
    }));

    return {
      attendanceTrend,
      persistentAbsence,
      behaviourPoints,
      assessmentDistribution,
      subjects,
    };
  });
}
