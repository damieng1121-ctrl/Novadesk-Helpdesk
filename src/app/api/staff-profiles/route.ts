import { z } from "zod";
import { requireMisSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/roles";

export async function GET() {
  return withApiErrors(async () => {
    const session = await requireMisSession();
    if (!isAdmin(session.user.role)) throw new AuthError("Admins only", 403);

    return prisma.user.findMany({
      where: {
        tenantId: session.user.tenantId,
        OR: [{ role: { in: ["AGENT", "TENANT_ADMIN", "REQUESTER"] } }, { isTeacher: true }],
      },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        jobTitle: true,
        isTeacher: true,
        staffProfile: true,
      },
    });
  });
}

const upsertSchema = z.object({
  userId: z.string().min(1),
  staffType: z.enum(["TEACHING", "TEACHING_ASSISTANT", "ADMIN", "SITE", "MIDDAY", "SENCO", "OTHER"]),
  dbsCheckDate: z.string().datetime().nullable().optional(),
  dbsNumber: z.string().max(60).nullable().optional(),
  contractType: z.string().max(60).nullable().optional(),
  startDate: z.string().datetime().nullable().optional(),
  endDate: z.string().datetime().nullable().optional(),
  safeguardingTrainingDate: z.string().datetime().nullable().optional(),
});

export async function POST(req: Request) {
  return withApiErrors(async () => {
    const session = await requireMisSession();
    if (!isAdmin(session.user.role)) throw new AuthError("Admins only", 403);
    const { userId, ...body } = upsertSchema.parse(await req.json());

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.tenantId !== session.user.tenantId) throw new AuthError("User not found", 404);

    const data = {
      staffType: body.staffType,
      dbsCheckDate: body.dbsCheckDate === undefined ? undefined : body.dbsCheckDate ? new Date(body.dbsCheckDate) : null,
      dbsNumber: body.dbsNumber,
      contractType: body.contractType,
      startDate: body.startDate === undefined ? undefined : body.startDate ? new Date(body.startDate) : null,
      endDate: body.endDate === undefined ? undefined : body.endDate ? new Date(body.endDate) : null,
      safeguardingTrainingDate:
        body.safeguardingTrainingDate === undefined
          ? undefined
          : body.safeguardingTrainingDate
            ? new Date(body.safeguardingTrainingDate)
            : null,
    };

    return prisma.staffProfile.upsert({
      where: { userId },
      create: { tenantId: session.user.tenantId, userId, ...data },
      update: data,
    });
  });
}
