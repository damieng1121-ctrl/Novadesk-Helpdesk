import { z } from "zod";
import { requireMisSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/roles";

export async function GET() {
  return withApiErrors(async () => {
    const session = await requireMisSession();
    return prisma.club.findMany({
      where: { tenantId: session.user.tenantId },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      include: {
        staffLead: { select: { name: true, email: true } },
        memberships: {
          select: { id: true, status: true, pupilId: true, pupil: { select: { firstName: true, lastName: true } } },
        },
      },
    });
  });
}

const createSchema = z.object({
  academicYearId: z.string().min(1),
  name: z.string().min(1).max(150),
  description: z.string().max(2000).optional(),
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().min(1).max(10),
  endTime: z.string().min(1).max(10),
  capacity: z.number().int().min(1).optional(),
  staffLeadId: z.string().min(1).optional(),
});

export async function POST(req: Request) {
  return withApiErrors(async () => {
    const session = await requireMisSession();
    if (!isAdmin(session.user.role)) throw new AuthError("Admins only", 403);
    const body = createSchema.parse(await req.json());

    return prisma.club.create({
      data: { ...body, tenantId: session.user.tenantId },
      include: { staffLead: { select: { name: true, email: true } }, memberships: true },
    });
  });
}
