import { z } from "zod";
import { requireMisSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/roles";
import type { Prisma } from "@prisma/client";

export async function GET(req: Request) {
  return withApiErrors(async () => {
    const session = await requireMisSession();
    const pupilId = new URL(req.url).searchParams.get("pupilId");

    const where: Prisma.BehaviourIncidentWhereInput = {
      tenantId: session.user.tenantId,
      ...(pupilId ? { pupilId } : {}),
    };

    const incidents = await prisma.behaviourIncident.findMany({
      where,
      orderBy: { date: "desc" },
      include: {
        pupil: { select: { firstName: true, lastName: true } },
        recordedBy: { select: { name: true, email: true } },
      },
    });

    // Confidential incidents (auto-set for SAFEGUARDING/BULLYING) are hidden
    // from non-admins unless they're the one who recorded it.
    if (isAdmin(session.user.role)) return incidents;
    return incidents.filter((i) => !i.isConfidential || i.recordedById === session.user.id);
  });
}

const createSchema = z.object({
  pupilId: z.string().min(1),
  date: z.coerce.date(),
  category: z.enum(["ACHIEVEMENT", "CONCERN", "BULLYING", "SAFEGUARDING"]),
  points: z.number().int(),
  description: z.string().min(1).max(4000),
  location: z.string().max(200).optional(),
  actionTaken: z.string().max(4000).optional(),
  followUpRequired: z.boolean().optional(),
  followUpNotes: z.string().max(4000).optional(),
});

export async function POST(req: Request) {
  return withApiErrors(async () => {
    const session = await requireMisSession();
    const body = createSchema.parse(await req.json());

    const pupil = await prisma.pupil.findUnique({ where: { id: body.pupilId } });
    if (!pupil || pupil.tenantId !== session.user.tenantId) throw new AuthError("Pupil not found", 404);

    const isConfidential = body.category === "SAFEGUARDING" || body.category === "BULLYING";

    return prisma.behaviourIncident.create({
      data: {
        ...body,
        isConfidential,
        tenantId: session.user.tenantId,
        recordedById: session.user.id,
      },
      include: {
        pupil: { select: { firstName: true, lastName: true } },
        recordedBy: { select: { name: true, email: true } },
      },
    });
  });
}
