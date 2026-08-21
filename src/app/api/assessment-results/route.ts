import { z } from "zod";
import { requireMisSession } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  return withApiErrors(async () => {
    const session = await requireMisSession();
    const { searchParams } = new URL(req.url);
    const pupilId = searchParams.get("pupilId") ?? undefined;
    const subjectId = searchParams.get("subjectId") ?? undefined;
    const academicYearId = searchParams.get("academicYearId") ?? undefined;

    return prisma.assessmentResult.findMany({
      where: { tenantId: session.user.tenantId, pupilId, subjectId, academicYearId },
      orderBy: { date: "desc" },
      include: {
        pupil: { select: { firstName: true, lastName: true } },
        subject: { select: { name: true } },
        teacher: { select: { name: true, email: true } },
      },
    });
  });
}

const createSchema = z.object({
  pupilId: z.string().min(1),
  subjectId: z.string().min(1),
  academicYearId: z.string().min(1),
  term: z.string().min(1).max(40),
  attainment: z.string().min(1).max(60),
  effort: z.string().max(60).optional(),
  notes: z.string().max(2000).optional(),
  date: z.string().datetime().optional(),
});

export async function POST(req: Request) {
  return withApiErrors(async () => {
    const session = await requireMisSession();
    const body = createSchema.parse(await req.json());
    const { date, ...rest } = body;

    return prisma.assessmentResult.create({
      data: {
        ...rest,
        tenantId: session.user.tenantId,
        teacherId: session.user.id,
        ...(date ? { date: new Date(date) } : {}),
      },
      include: {
        pupil: { select: { firstName: true, lastName: true } },
        subject: { select: { name: true } },
        teacher: { select: { name: true, email: true } },
      },
    });
  });
}
