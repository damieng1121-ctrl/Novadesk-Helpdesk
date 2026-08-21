import { z } from "zod";
import { requireMisSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  targetDate: z.string().datetime().nullable().optional(),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "ACHIEVED"]).optional(),
});

export async function PATCH(req: Request, { params }: Params) {
  return withApiErrors(async () => {
    const session = await requireMisSession();
    const { id } = await params;

    const record = await prisma.pupilTarget.findUnique({ where: { id } });
    if (!record || record.tenantId !== session.user.tenantId) throw new AuthError("Not found", 404);

    const { targetDate, ...body } = patchSchema.parse(await req.json());

    return prisma.pupilTarget.update({
      where: { id },
      data: {
        ...body,
        ...(targetDate !== undefined ? { targetDate: targetDate ? new Date(targetDate) : null } : {}),
      },
      include: {
        pupil: { select: { firstName: true, lastName: true } },
        subject: { select: { name: true } },
        createdBy: { select: { name: true, email: true } },
      },
    });
  });
}
