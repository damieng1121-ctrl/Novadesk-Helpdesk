import { z } from "zod";
import { requireMisSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  term: z.string().min(1).max(40).optional(),
  attainment: z.string().min(1).max(60).optional(),
  effort: z.string().max(60).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export async function PATCH(req: Request, { params }: Params) {
  return withApiErrors(async () => {
    const session = await requireMisSession();
    const { id } = await params;

    const record = await prisma.assessmentResult.findUnique({ where: { id } });
    if (!record || record.tenantId !== session.user.tenantId) throw new AuthError("Not found", 404);

    const body = patchSchema.parse(await req.json());

    return prisma.assessmentResult.update({
      where: { id },
      data: body,
      include: {
        pupil: { select: { firstName: true, lastName: true } },
        subject: { select: { name: true } },
        teacher: { select: { name: true, email: true } },
      },
    });
  });
}

export async function DELETE(_req: Request, { params }: Params) {
  return withApiErrors(async () => {
    const session = await requireMisSession();
    const { id } = await params;

    const record = await prisma.assessmentResult.findUnique({ where: { id } });
    if (!record || record.tenantId !== session.user.tenantId) throw new AuthError("Not found", 404);

    await prisma.assessmentResult.delete({ where: { id } });
    return { ok: true };
  });
}
