import { z } from "zod";
import { requireMisSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

const targetSchema = z.object({
  target: z.string().min(1).max(1000),
  progress: z.string().max(2000),
  reviewDate: z.string().max(40),
});

const patchSchema = z.object({
  status: z.enum(["NONE", "SEND_SUPPORT", "EHCP"]).optional(),
  primaryNeed: z.enum(["COMMUNICATION", "COGNITION", "SEMH", "SENSORY_PHYSICAL"]).optional(),
  description: z.string().min(1).max(4000).optional(),
  targets: z.array(targetSchema).optional(),
  externalAgencies: z.string().max(2000).optional(),
  reviewDate: z.coerce.date().optional(),
});

export async function PATCH(req: Request, { params }: Params) {
  return withApiErrors(async () => {
    const session = await requireMisSession();
    const { id } = await params;

    const plan = await prisma.sendPlan.findUnique({ where: { id } });
    if (!plan || plan.tenantId !== session.user.tenantId) throw new AuthError("Not found", 404);

    const body = patchSchema.parse(await req.json());

    const updated = await prisma.sendPlan.update({
      where: { id },
      data: body,
      include: {
        pupil: { select: { firstName: true, lastName: true, sendStatus: true } },
        createdBy: { select: { name: true, email: true } },
      },
    });

    if (body.status && body.status !== plan.status) {
      await prisma.pupil.update({ where: { id: plan.pupilId }, data: { sendStatus: body.status } });
    }

    return updated;
  });
}
