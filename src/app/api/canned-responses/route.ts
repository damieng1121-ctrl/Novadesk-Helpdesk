import { z } from "zod";
import { requireTenantSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { canManageTickets, isAdmin } from "@/lib/roles";

export async function GET() {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!canManageTickets(session.user.role)) throw new AuthError("Staff only", 403);
    return prisma.cannedResponse.findMany({
      where: { tenantId: session.user.tenantId },
      orderBy: { title: "asc" },
    });
  });
}

const createSchema = z.object({
  title: z.string().min(1).max(100),
  shortcut: z.string().min(1).max(30).regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, and hyphens only"),
  content: z.string().min(1).max(3000),
});

export async function POST(req: Request) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!isAdmin(session.user.role)) throw new AuthError("Only admins can manage canned responses", 403);
    const body = createSchema.parse(await req.json());
    return prisma.cannedResponse.create({ data: { ...body, tenantId: session.user.tenantId } });
  });
}
