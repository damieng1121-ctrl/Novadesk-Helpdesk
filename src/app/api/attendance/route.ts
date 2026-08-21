import { z } from "zod";
import { requireMisSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { getAttendanceCode } from "@/lib/attendance-codes";

function startOfDay(dateStr: string): Date {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function GET(req: Request) {
  return withApiErrors(async () => {
    const session = await requireMisSession();
    const { searchParams } = new URL(req.url);
    const formGroupId = searchParams.get("formGroupId");
    const date = searchParams.get("date");
    const attSession = searchParams.get("session");

    if (!formGroupId || !date || (attSession !== "AM" && attSession !== "PM")) {
      throw new AuthError("formGroupId, date and session are required", 400);
    }

    const formGroup = await prisma.formGroup.findUnique({ where: { id: formGroupId } });
    if (!formGroup || formGroup.tenantId !== session.user.tenantId) throw new AuthError("Form group not found", 404);

    const day = startOfDay(date);

    const [pupils, records] = await Promise.all([
      prisma.pupil.findMany({
        where: { tenantId: session.user.tenantId, formGroupId, isDeleted: false },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),
      prisma.attendanceRecord.findMany({
        where: { tenantId: session.user.tenantId, pupil: { formGroupId }, date: day, session: attSession },
      }),
    ]);

    const recordByPupil = new Map(records.map((r) => [r.pupilId, r]));

    return pupils.map((p) => ({
      pupil: { id: p.id, firstName: p.firstName, lastName: p.lastName, preferredName: p.preferredName },
      record: recordByPupil.get(p.id) ?? null,
    }));
  });
}

const entrySchema = z.object({
  pupilId: z.string().min(1),
  mark: z.enum(["PRESENT", "LATE", "AUTHORISED_ABSENCE", "UNAUTHORISED_ABSENCE", "APPROVED_ACTIVITY", "NOT_RECORDED"]),
  statutoryCode: z.string().min(1).max(4),
  minutesLate: z.number().int().min(0).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

const bulkSchema = z.object({
  formGroupId: z.string().min(1),
  date: z.coerce.date(),
  session: z.enum(["AM", "PM"]),
  entries: z.array(entrySchema).min(1),
});

export async function POST(req: Request) {
  return withApiErrors(async () => {
    const session = await requireMisSession();
    const body = bulkSchema.parse(await req.json());

    const formGroup = await prisma.formGroup.findUnique({ where: { id: body.formGroupId } });
    if (!formGroup || formGroup.tenantId !== session.user.tenantId) throw new AuthError("Form group not found", 404);

    const day = new Date(body.date);
    day.setHours(0, 0, 0, 0);

    const pupils = await prisma.pupil.findMany({
      where: { tenantId: session.user.tenantId, formGroupId: body.formGroupId, isDeleted: false },
      select: { id: true },
    });
    const validPupilIds = new Set(pupils.map((p) => p.id));

    const results = await Promise.all(
      body.entries
        .filter((entry) => validPupilIds.has(entry.pupilId))
        .map((entry) => {
          const codeInfo = getAttendanceCode(entry.statutoryCode);
          const mark = codeInfo?.mark ?? entry.mark;
          return prisma.attendanceRecord.upsert({
            where: {
              tenantId_pupilId_date_session: {
                tenantId: session.user.tenantId,
                pupilId: entry.pupilId,
                date: day,
                session: body.session,
              },
            },
            create: {
              tenantId: session.user.tenantId,
              pupilId: entry.pupilId,
              date: day,
              session: body.session,
              mark,
              statutoryCode: entry.statutoryCode,
              minutesLate: entry.minutesLate ?? null,
              notes: entry.notes ?? null,
              recordedById: session.user.id,
            },
            update: {
              mark,
              statutoryCode: entry.statutoryCode,
              minutesLate: entry.minutesLate ?? null,
              notes: entry.notes ?? null,
              recordedById: session.user.id,
            },
          });
        }),
    );

    return { ok: true, count: results.length };
  });
}
