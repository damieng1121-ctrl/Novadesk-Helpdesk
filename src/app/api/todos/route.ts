import { z } from "zod";
import { requireTenantSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { canManageTickets } from "@/lib/roles";

// Personal to-do lists — deliberately not shared or assignable to others,
// so every query is scoped to the caller's own userId, never just tenantId.
export async function GET() {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!canManageTickets(session.user.role)) throw new AuthError("Staff only", 403);
    return prisma.agentTodo.findMany({
      where: { userId: session.user.id },
      orderBy: [{ isDone: "asc" }, { createdAt: "desc" }],
    });
  });
}

const createSchema = z.object({
  text: z.string().trim().min(1).max(500),
});

export async function POST(req: Request) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!canManageTickets(session.user.role)) throw new AuthError("Staff only", 403);
    const { text } = createSchema.parse(await req.json());
    return prisma.agentTodo.create({
      data: { tenantId: session.user.tenantId, userId: session.user.id, text },
    });
  });
}
