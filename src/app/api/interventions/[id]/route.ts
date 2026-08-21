import { z } from "zod";
import { requireMisSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  subjectArea: z.string().max(200).optional(),
  providerId: z.string().min(1).optional(),
  groupSize: z.number().int().min(1).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  targetOutcome: z.string().min(1).max(4000).optional(),
  status: z.enum(["PLANNED", "ACTIVE", "COMPLETED"]).optional(),
});

export async function PATCH(req: Request, { params }: Params) {
  return withApiErrors(async () => {
    const session = await requireMisSession();
    const { id } = await params;

    const intervention = await prisma.intervention.findUnique({ where: { id } });
    if (!intervention || intervention.tenantId !== session.user.tenantId) throw new AuthError("Not found", 404);

    const body = patchSchema.parse(await req.json());

    return prisma.intervention.update({
      where: { id },
      data: body,
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
