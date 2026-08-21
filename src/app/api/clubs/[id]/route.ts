import { z } from "zod";
import { requireMisSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/roles";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  description: z.string().max(2000).nullable().optional(),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  startTime: z.string().min(1).max(10).optional(),
  endTime: z.string().min(1).max(10).optional(),
  capacity: z.number().int().min(1).nullable().optional(),
  staffLeadId: z.string().min(1).nullable().optional(),
});

export async function PATCH(req: Request, { params }: Params) {
  return withApiErrors(async () => {
    const session = await requireMisSession();
    if (!isAdmin(session.user.role)) throw new AuthError("Admins only", 403);
    const { id } = await params;

    const club = await prisma.club.findUnique({ where: { id } });
    if (!club || club.tenantId !== session.user.tenantId) throw new AuthError("Not found", 404);

    const body = patchSchema.parse(await req.json());

    return prisma.club.update({
      where: { id },
      data: body,
      include: {
        staffLead: { select: { name: true, email: true } },
        memberships: {
          select: { id: true, status: true, pupilId: true, pupil: { select: { firstName: true, lastName: true } } },
        },
      },
    });
  });
}

export async function DELETE(_req: Request, { params }: Params) {
  return withApiErrors(async () => {
    const session = await requireMisSession();
    if (!isAdmin(session.user.role)) throw new AuthError("Admins only", 403);
    const { id } = await params;

    const club = await prisma.club.findUnique({ where: { id } });
    if (!club || club.tenantId !== session.user.tenantId) throw new AuthError("Not found", 404);

    await prisma.club.delete({ where: { id } });
    return { ok: true };
  });
}
