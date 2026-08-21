import { z } from "zod";
import { requireMisSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";

/** Midnight UTC for the given YYYY-MM-DD, matching how the date is stored (mirrors attendance register conventions). */
function dayStart(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

export async function GET(req: Request) {
  return withApiErrors(async () => {
    const session = await requireMisSession();
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    const formGroupId = searchParams.get("formGroupId");
    if (!date) throw new AuthError("date is required", 400);
    if (!formGroupId) throw new AuthError("formGroupId is required", 400);

    const formGroup = await prisma.formGroup.findUnique({ where: { id: formGroupId } });
    if (!formGroup || formGroup.tenantId !== session.user.tenantId) throw new AuthError("Form group not found", 404);

    const pupils = await prisma.pupil.findMany({
      where: { tenantId: session.user.tenantId, formGroupId, isDeleted: false },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });

    const records = await prisma.mealRecord.findMany({
      where: { tenantId: session.user.tenantId, date: dayStart(date), pupilId: { in: pupils.map((p) => p.id) } },
    });
    const byPupil = new Map(records.map((r) => [r.pupilId, r]));

    return pupils.map((p) => ({
      pupilId: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      mealType: byPupil.get(p.id)?.mealType ?? null,
    }));
  });
}

const bulkSchema = z.object({
  date: z.string().min(1),
  records: z.array(
    z.object({
      pupilId: z.string().min(1),
      mealType: z.enum(["SCHOOL_MEAL", "PACKED_LUNCH", "HOME", "FSM"]),
    }),
  ),
});

export async function POST(req: Request) {
  return withApiErrors(async () => {
    const session = await requireMisSession();
    const { date, records } = bulkSchema.parse(await req.json());
    const day = dayStart(date);

    const pupils = await prisma.pupil.findMany({
      where: { tenantId: session.user.tenantId, id: { in: records.map((r) => r.pupilId) } },
      select: { id: true },
    });
    const validIds = new Set(pupils.map((p) => p.id));

    await prisma.$transaction(
      records
        .filter((r) => validIds.has(r.pupilId))
        .map((r) =>
          prisma.mealRecord.upsert({
            where: { tenantId_pupilId_date: { tenantId: session.user.tenantId, pupilId: r.pupilId, date: day } },
            create: {
              tenantId: session.user.tenantId,
              pupilId: r.pupilId,
              date: day,
              mealType: r.mealType,
              recordedById: session.user.id,
            },
            update: { mealType: r.mealType, recordedById: session.user.id },
          }),
        ),
    );

    return { ok: true, count: records.length };
  });
}
