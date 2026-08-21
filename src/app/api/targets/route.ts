import { z } from "zod";
import { requireMisSession } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  return withApiErrors(async () => {
    const session = await requireMisSession();
    const { searchParams } = new URL(req.url);
    const pupilId = searchParams.get("pupilId") ?? undefined;

    return prisma.pupilTarget.findMany({
      where: { tenantId: session.user.tenantId, pupilId },
      orderBy: { createdAt: "desc" },
      include: {
        pupil: { select: { firstName: true, lastName: true } },
        subject: { select: { name: true } },
        createdBy: { select: { name: true, email: true } },
      },
    });
  });
}

const createSchema = z.object({
  pupilId: z.string().min(1),
  subjectId: z.string().min(1).optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  targetDate: z.string().datetime().optional(),
});

export async function POST(req: Request) {
  return withApiErrors(async () => {
    const session = await requireMisSession();
    const body = createSchema.parse(await req.json());
    const { targetDate, ...rest } = body;

    return prisma.pupilTarget.create({
      data: {
        ...rest,
        tenantId: session.user.tenantId,
        createdById: session.user.id,
        ...(targetDate ? { targetDate: new Date(targetDate) } : {}),
      },
      include: {
        pupil: { select: { firstName: true, lastName: true } },
        subject: { select: { name: true } },
        createdBy: { select: { name: true, email: true } },
      },
    });
  });
}
