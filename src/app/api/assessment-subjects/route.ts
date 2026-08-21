import { z } from "zod";
import { requireMisSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/roles";

export async function GET() {
  return withApiErrors(async () => {
    const session = await requireMisSession();
    return prisma.assessmentSubject.findMany({
      where: { tenantId: session.user.tenantId },
      orderBy: { order: "asc" },
    });
  });
}

const createSchema = z.object({
  name: z.string().min(1).max(100),
  order: z.number().int().optional(),
});

export async function POST(req: Request) {
  return withApiErrors(async () => {
    const session = await requireMisSession();
    if (!isAdmin(session.user.role)) throw new AuthError("Admins only", 403);
    const body = createSchema.parse(await req.json());

    return prisma.assessmentSubject.create({
      data: { ...body, tenantId: session.user.tenantId },
    });
  });
}
