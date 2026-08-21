import { z } from "zod";
import { requireMisSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

const targetSchema = z.object({
  target: z.string().min(1).max(1000),
  progress: z.string().max(2000),
  reviewDate: z.string().max(40),
});

export async function GET(req: Request) {
  return withApiErrors(async () => {
    const session = await requireMisSession();
    const pupilId = new URL(req.url).searchParams.get("pupilId");

    const where: Prisma.SendPlanWhereInput = {
      tenantId: session.user.tenantId,
      ...(pupilId ? { pupilId } : {}),
    };

    return prisma.sendPlan.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        pupil: { select: { firstName: true, lastName: true, sendStatus: true } },
        createdBy: { select: { name: true, email: true } },
      },
    });
  });
}

const createSchema = z.object({
  pupilId: z.string().min(1),
  status: z.enum(["NONE", "SEND_SUPPORT", "EHCP"]),
  primaryNeed: z.enum(["COMMUNICATION", "COGNITION", "SEMH", "SENSORY_PHYSICAL"]).optional(),
  description: z.string().min(1).max(4000),
  targets: z.array(targetSchema).optional(),
  externalAgencies: z.string().max(2000).optional(),
  reviewDate: z.coerce.date().optional(),
});

export async function POST(req: Request) {
  return withApiErrors(async () => {
    const session = await requireMisSession();
    const body = createSchema.parse(await req.json());

    const pupil = await prisma.pupil.findUnique({ where: { id: body.pupilId } });
    if (!pupil || pupil.tenantId !== session.user.tenantId) throw new AuthError("Pupil not found", 404);

    const { targets, ...rest } = body;

    const plan = await prisma.sendPlan.create({
      data: {
        ...rest,
        targets: targets ?? [],
        tenantId: session.user.tenantId,
        createdById: session.user.id,
      },
      include: {
        pupil: { select: { firstName: true, lastName: true, sendStatus: true } },
        createdBy: { select: { name: true, email: true } },
      },
    });

    if (body.status !== "NONE") {
      await prisma.pupil.update({ where: { id: body.pupilId }, data: { sendStatus: body.status } });
    }

    return plan;
  });
}
