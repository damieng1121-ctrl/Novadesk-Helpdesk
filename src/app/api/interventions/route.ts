import { z } from "zod";
import { requireMisSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export async function GET(req: Request) {
  return withApiErrors(async () => {
    const session = await requireMisSession();
    const pupilId = new URL(req.url).searchParams.get("pupilId");

    const where: Prisma.InterventionWhereInput = {
      tenantId: session.user.tenantId,
      ...(pupilId ? { pupilId } : {}),
    };

    return prisma.intervention.findMany({
      where,
      orderBy: { startDate: "desc" },
      include: {
        pupil: { select: { firstName: true, lastName: true } },
        provider: { select: { name: true, email: true } },
        notes: {
          orderBy: { createdAt: "desc" },
          include: { author: { select: { name: true, email: true } } },
        },
      },
    });
  });
}

const createSchema = z.object({
  pupilId: z.string().min(1),
  title: z.string().min(1).max(200),
  subjectArea: z.string().max(200).optional(),
  providerId: z.string().min(1).optional(),
  groupSize: z.number().int().min(1).optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  targetOutcome: z.string().min(1).max(4000),
  status: z.enum(["PLANNED", "ACTIVE", "COMPLETED"]).optional(),
});

export async function POST(req: Request) {
  return withApiErrors(async () => {
    const session = await requireMisSession();
    const body = createSchema.parse(await req.json());

    const pupil = await prisma.pupil.findUnique({ where: { id: body.pupilId } });
    if (!pupil || pupil.tenantId !== session.user.tenantId) throw new AuthError("Pupil not found", 404);

    const { providerId, ...rest } = body;

    return prisma.intervention.create({
      data: {
        ...rest,
        providerId: providerId ?? session.user.id,
        tenantId: session.user.tenantId,
      },
      include: {
        pupil: { select: { firstName: true, lastName: true } },
        provider: { select: { name: true, email: true } },
        notes: true,
      },
    });
  });
}
