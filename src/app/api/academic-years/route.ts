import { z } from "zod";
import { requireMisSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/roles";

export async function GET() {
  return withApiErrors(async () => {
    const session = await requireMisSession();
    return prisma.academicYear.findMany({
      where: { tenantId: session.user.tenantId },
      orderBy: { startDate: "desc" },
    });
  });
}

const createSchema = z.object({
  name: z.string().min(1).max(20),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  isCurrent: z.boolean().optional(),
});

export async function POST(req: Request) {
  return withApiErrors(async () => {
    const session = await requireMisSession();
    if (!isAdmin(session.user.role)) throw new AuthError("Admins only", 403);
    const body = createSchema.parse(await req.json());

    if (body.isCurrent) {
      await prisma.academicYear.updateMany({
        where: { tenantId: session.user.tenantId, isCurrent: true },
        data: { isCurrent: false },
      });
    }

    return prisma.academicYear.create({
      data: { ...body, tenantId: session.user.tenantId },
    });
  });
}
