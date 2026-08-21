import { requireParentSession } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function GET() {
  return withApiErrors(async () => {
    const session = await requireParentSession();

    const links = await prisma.pupilGuardian.findMany({
      where: { tenantId: session.user.tenantId, guardianId: session.user.id },
      orderBy: { priorityOrder: "asc" },
      include: {
        pupil: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            preferredName: true,
            yearGroup: true,
            photoUrl: true,
            formGroup: { select: { id: true, name: true } },
          },
        },
      },
    });

    return links.map((l) => ({
      relationship: l.relationship,
      pupil: l.pupil,
    }));
  });
}
