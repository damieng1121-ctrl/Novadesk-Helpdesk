import { z } from "zod";
import { requireTenantSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/roles";

export async function GET() {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!isAdmin(session.user.role)) throw new AuthError("Only admins can manage announcements", 403);
    return prisma.announcement.findMany({
      where: { tenantId: session.user.tenantId },
      orderBy: { createdAt: "desc" },
    });
  });
}

const createSchema = z.object({
  title: z.string().min(1).max(150),
  message: z.string().min(1).max(2000),
  type: z.enum(["INFO", "WARNING", "ALERT"]).optional(),
  targetAudience: z.enum(["ALL", "STAFF", "REQUESTERS"]).optional(),
});

export async function POST(req: Request) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!isAdmin(session.user.role)) throw new AuthError("Only admins can manage announcements", 403);
    const body = createSchema.parse(await req.json());
    return prisma.announcement.create({
      data: { ...body, tenantId: session.user.tenantId, createdById: session.user.id },
    });
  });
}
