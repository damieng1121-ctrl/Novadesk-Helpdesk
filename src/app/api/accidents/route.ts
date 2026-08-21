import { z } from "zod";
import { requireMisSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export async function GET(req: Request) {
  return withApiErrors(async () => {
    const session = await requireMisSession();
    const pupilId = new URL(req.url).searchParams.get("pupilId");

    const where: Prisma.AccidentReportWhereInput = {
      tenantId: session.user.tenantId,
      ...(pupilId ? { pupilId } : {}),
    };

    return prisma.accidentReport.findMany({
      where,
      orderBy: { date: "desc" },
      include: {
        pupil: { select: { firstName: true, lastName: true } },
        reportedBy: { select: { name: true, email: true } },
        firstAidGivenBy: { select: { name: true, email: true } },
      },
    });
  });
}

const createSchema = z.object({
  pupilId: z.string().min(1),
  date: z.coerce.date(),
  time: z.string().min(1).max(10),
  location: z.string().min(1).max(200),
  description: z.string().min(1).max(4000),
  injuryType: z.string().max(200).optional(),
  actionTaken: z.string().min(1).max(4000),
  severity: z.enum(["MINOR", "MODERATE", "SERIOUS"]),
  parentNotified: z.boolean().optional(),
  firstAidGivenById: z.string().optional(),
});

export async function POST(req: Request) {
  return withApiErrors(async () => {
    const session = await requireMisSession();
    const body = createSchema.parse(await req.json());

    const pupil = await prisma.pupil.findUnique({ where: { id: body.pupilId } });
    if (!pupil || pupil.tenantId !== session.user.tenantId) throw new AuthError("Pupil not found", 404);

    const { parentNotified, ...rest } = body;

    return prisma.accidentReport.create({
      data: {
        ...rest,
        parentNotified: parentNotified ?? false,
        parentNotifiedAt: parentNotified ? new Date() : null,
        tenantId: session.user.tenantId,
        reportedById: session.user.id,
      },
      include: {
        pupil: { select: { firstName: true, lastName: true } },
        reportedBy: { select: { name: true, email: true } },
        firstAidGivenBy: { select: { name: true, email: true } },
      },
    });
  });
}
