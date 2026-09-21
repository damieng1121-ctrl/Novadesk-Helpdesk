import { z } from "zod";
import { requireTenantSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/roles";

export async function GET() {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    return prisma.holiday.findMany({
      where: { tenantId: session.user.tenantId },
      orderBy: { date: "asc" },
    });
  });
}

const createSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  name: z.string().trim().min(1).max(100),
});

export async function POST(req: Request) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!isAdmin(session.user.role)) throw new AuthError("Only admins can manage holidays", 403);
    const body = createSchema.parse(await req.json());
    return prisma.holiday.upsert({
      where: { tenantId_date: { tenantId: session.user.tenantId, date: new Date(body.date) } },
      create: { tenantId: session.user.tenantId, date: new Date(body.date), name: body.name },
      update: { name: body.name },
    });
  });
}
