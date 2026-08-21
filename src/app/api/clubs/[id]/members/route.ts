import { z } from "zod";
import { requireMisSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

const addSchema = z.object({ pupilId: z.string().min(1) });

export async function POST(req: Request, { params }: Params) {
  return withApiErrors(async () => {
    const session = await requireMisSession();
    const { id: clubId } = await params;

    const club = await prisma.club.findUnique({ where: { id: clubId } });
    if (!club || club.tenantId !== session.user.tenantId) throw new AuthError("Not found", 404);

    const { pupilId } = addSchema.parse(await req.json());

    const pupil = await prisma.pupil.findUnique({ where: { id: pupilId } });
    if (!pupil || pupil.tenantId !== session.user.tenantId) throw new AuthError("Pupil not found", 404);

    const activeCount = club.capacity
      ? await prisma.clubMembership.count({ where: { clubId, status: "ACTIVE" } })
      : 0;
    const status = club.capacity && activeCount >= club.capacity ? "WAITLIST" : "ACTIVE";

    return prisma.clubMembership.upsert({
      where: { clubId_pupilId: { clubId, pupilId } },
      create: { tenantId: session.user.tenantId, clubId, pupilId, status },
      update: {},
      include: { pupil: { select: { firstName: true, lastName: true } } },
    });
  });
}

export async function DELETE(req: Request, { params }: Params) {
  return withApiErrors(async () => {
    const session = await requireMisSession();
    const { id: clubId } = await params;

    const club = await prisma.club.findUnique({ where: { id: clubId } });
    if (!club || club.tenantId !== session.user.tenantId) throw new AuthError("Not found", 404);

    const { searchParams } = new URL(req.url);
    const pupilId = searchParams.get("pupilId");
    if (!pupilId) throw new AuthError("pupilId is required", 400);

    const membership = await prisma.clubMembership.findUnique({ where: { clubId_pupilId: { clubId, pupilId } } });
    if (!membership || membership.tenantId !== session.user.tenantId) throw new AuthError("Not found", 404);

    await prisma.clubMembership.delete({ where: { id: membership.id } });

    // Promote the longest-waiting waitlisted pupil into the freed ACTIVE slot, if any.
    if (membership.status === "ACTIVE") {
      const nextInLine = await prisma.clubMembership.findFirst({
        where: { clubId, status: "WAITLIST" },
        orderBy: { joinedAt: "asc" },
      });
      if (nextInLine) {
        await prisma.clubMembership.update({ where: { id: nextInLine.id }, data: { status: "ACTIVE" } });
      }
    }

    return { ok: true };
  });
}
