import { z } from "zod";
import { requireMisSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/roles";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  date: z.coerce.date().optional(),
  category: z.enum(["ACHIEVEMENT", "CONCERN", "BULLYING", "SAFEGUARDING"]).optional(),
  points: z.number().int().optional(),
  description: z.string().min(1).max(4000).optional(),
  location: z.string().max(200).optional(),
  actionTaken: z.string().max(4000).optional(),
  followUpRequired: z.boolean().optional(),
  followUpNotes: z.string().max(4000).optional(),
});

async function loadOwnIncident(id: string, tenantId: string) {
  const incident = await prisma.behaviourIncident.findUnique({ where: { id } });
  if (!incident || incident.tenantId !== tenantId) throw new AuthError("Not found", 404);
  return incident;
}

export async function PATCH(req: Request, { params }: Params) {
  return withApiErrors(async () => {
    const session = await requireMisSession();
    const { id } = await params;
    const incident = await loadOwnIncident(id, session.user.tenantId);

    if (incident.isConfidential && !isAdmin(session.user.role) && incident.recordedById !== session.user.id) {
      throw new AuthError("Not found", 404);
    }

    const body = patchSchema.parse(await req.json());
    const category = body.category ?? incident.category;
    const isConfidential = category === "SAFEGUARDING" || category === "BULLYING";

    return prisma.behaviourIncident.update({
      where: { id },
      data: { ...body, isConfidential },
      include: {
        pupil: { select: { firstName: true, lastName: true } },
        recordedBy: { select: { name: true, email: true } },
      },
    });
  });
}

export async function DELETE(_req: Request, { params }: Params) {
  return withApiErrors(async () => {
    const session = await requireMisSession();
    if (!isAdmin(session.user.role)) throw new AuthError("Only admins can delete behaviour incidents", 403);
    const { id } = await params;
    await loadOwnIncident(id, session.user.tenantId);

    await prisma.behaviourIncident.delete({ where: { id } });
    return { ok: true };
  });
}
