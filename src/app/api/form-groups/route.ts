import { z } from "zod";
import { requireMisSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/roles";

const YEAR_GROUPS = [
  "NURSERY", "RECEPTION", "YEAR_1", "YEAR_2", "YEAR_3", "YEAR_4", "YEAR_5",
  "YEAR_6", "YEAR_7", "YEAR_8", "YEAR_9", "YEAR_10", "YEAR_11", "YEAR_12", "YEAR_13",
] as const;

export async function GET() {
  return withApiErrors(async () => {
    const session = await requireMisSession();
    return prisma.formGroup.findMany({
      where: { tenantId: session.user.tenantId },
      orderBy: { name: "asc" },
      include: {
        academicYear: { select: { id: true, name: true, isCurrent: true } },
        staffLead: { select: { name: true, email: true } },
        _count: { select: { pupils: true } },
      },
    });
  });
}

const createSchema = z.object({
  academicYearId: z.string().min(1),
  name: z.string().min(1).max(20),
  yearGroup: z.enum(YEAR_GROUPS),
  staffLeadId: z.string().min(1).optional(),
});

export async function POST(req: Request) {
  return withApiErrors(async () => {
    const session = await requireMisSession();
    if (!isAdmin(session.user.role)) throw new AuthError("Admins only", 403);
    const body = createSchema.parse(await req.json());

    const academicYear = await prisma.academicYear.findUnique({ where: { id: body.academicYearId } });
    if (!academicYear || academicYear.tenantId !== session.user.tenantId) {
      throw new AuthError("Academic year not found", 404);
    }

    return prisma.formGroup.create({
      data: { ...body, tenantId: session.user.tenantId },
      include: {
        academicYear: { select: { id: true, name: true, isCurrent: true } },
        staffLead: { select: { name: true, email: true } },
      },
    });
  });
}
