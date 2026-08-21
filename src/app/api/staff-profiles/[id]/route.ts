import { z } from "zod";
import { requireMisSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/roles";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  staffType: z.enum(["TEACHING", "TEACHING_ASSISTANT", "ADMIN", "SITE", "MIDDAY", "SENCO", "OTHER"]).optional(),
  dbsCheckDate: z.string().datetime().nullable().optional(),
  dbsNumber: z.string().max(60).nullable().optional(),
  contractType: z.string().max(60).nullable().optional(),
  startDate: z.string().datetime().nullable().optional(),
  endDate: z.string().datetime().nullable().optional(),
  safeguardingTrainingDate: z.string().datetime().nullable().optional(),
});

export async function PATCH(req: Request, { params }: Params) {
  return withApiErrors(async () => {
    const session = await requireMisSession();
    if (!isAdmin(session.user.role)) throw new AuthError("Admins only", 403);
    const { id } = await params;

    const profile = await prisma.staffProfile.findUnique({ where: { id } });
    if (!profile || profile.tenantId !== session.user.tenantId) throw new AuthError("Not found", 404);

    const body = patchSchema.parse(await req.json());

    return prisma.staffProfile.update({
      where: { id },
      data: {
        ...body,
        dbsCheckDate: body.dbsCheckDate === undefined ? undefined : body.dbsCheckDate ? new Date(body.dbsCheckDate) : null,
        startDate: body.startDate === undefined ? undefined : body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate === undefined ? undefined : body.endDate ? new Date(body.endDate) : null,
        safeguardingTrainingDate:
          body.safeguardingTrainingDate === undefined
            ? undefined
            : body.safeguardingTrainingDate
              ? new Date(body.safeguardingTrainingDate)
              : null,
      },
    });
  });
}
