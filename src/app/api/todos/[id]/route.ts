import { z } from "zod";
import { requireTenantSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { canManageTickets } from "@/lib/roles";

type Params = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  text: z.string().trim().min(1).max(500).optional(),
  isDone: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: Params) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!canManageTickets(session.user.role)) throw new AuthError("Staff only", 403);
    const { id } = await params;
    const existing = await prisma.agentTodo.findUnique({ where: { id } });
    if (!existing || existing.userId !== session.user.id) throw new AuthError("Not found", 404);

    const data = updateSchema.parse(await req.json());
    return prisma.agentTodo.update({ where: { id }, data });
  });
}

export async function DELETE(_req: Request, { params }: Params) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!canManageTickets(session.user.role)) throw new AuthError("Staff only", 403);
    const { id } = await params;
    const existing = await prisma.agentTodo.findUnique({ where: { id } });
    if (!existing || existing.userId !== session.user.id) throw new AuthError("Not found", 404);

    await prisma.agentTodo.delete({ where: { id } });
    return { ok: true };
  });
}
