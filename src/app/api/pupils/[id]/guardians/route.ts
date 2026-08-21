import { z } from "zod";
import { requireMisSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { issueParentSetPasswordToken } from "@/lib/parent-invite";

type Params = { params: Promise<{ id: string }> };

async function loadPupil(tenantId: string, pupilId: string) {
  const pupil = await prisma.pupil.findUnique({ where: { id: pupilId } });
  if (!pupil || pupil.tenantId !== tenantId) throw new AuthError("Pupil not found", 404);
  return pupil;
}

export async function GET(_req: Request, { params }: Params) {
  return withApiErrors(async () => {
    const session = await requireMisSession();
    const { id: pupilId } = await params;
    await loadPupil(session.user.tenantId, pupilId);

    return prisma.pupilGuardian.findMany({
      where: { tenantId: session.user.tenantId, pupilId },
      orderBy: { priorityOrder: "asc" },
      include: { guardian: { select: { id: true, name: true, email: true, phone: true } } },
    });
  });
}

const createSchema = z.object({
  email: z.email(),
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  relationship: z.enum(["MOTHER", "FATHER", "GUARDIAN", "GRANDPARENT", "CARER", "OTHER"]),
  parentalResponsibility: z.boolean().default(true),
  isPrimaryContact: z.boolean().default(false),
  isEmergencyContact: z.boolean().default(true),
  canCollect: z.boolean().default(true),
});

export async function POST(req: Request, { params }: Params) {
  return withApiErrors(async () => {
    const session = await requireMisSession();
    const { id: pupilId } = await params;
    await loadPupil(session.user.tenantId, pupilId);

    const body = createSchema.parse(await req.json());
    const email = body.email.toLowerCase();

    let guardian = await prisma.user.findUnique({ where: { email } });
    if (guardian) {
      if (guardian.role !== "PARENT" || guardian.tenantId !== session.user.tenantId) {
        throw new AuthError("This email belongs to an existing account that isn't a parent contact at this school", 409);
      }
    } else {
      guardian = await prisma.user.create({
        data: {
          email,
          name: `${body.firstName} ${body.lastName}`.trim(),
          role: "PARENT",
          tenantId: session.user.tenantId,
          isActive: true,
        },
      });
    }

    const existingLink = await prisma.pupilGuardian.findUnique({
      where: { pupilId_guardianId: { pupilId, guardianId: guardian.id } },
    });
    if (existingLink) throw new AuthError("This guardian is already linked to this pupil", 409);

    const link = await prisma.pupilGuardian.create({
      data: {
        tenantId: session.user.tenantId,
        pupilId,
        guardianId: guardian.id,
        relationship: body.relationship,
        parentalResponsibility: body.parentalResponsibility,
        isPrimaryContact: body.isPrimaryContact,
        isEmergencyContact: body.isEmergencyContact,
        canCollect: body.canCollect,
      },
      include: { guardian: { select: { id: true, name: true, email: true, phone: true } } },
    });

    await issueParentSetPasswordToken(email);

    return link;
  });
}
