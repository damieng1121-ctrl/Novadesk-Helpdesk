import { z } from "zod";
import { requireTenantSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional(),
});

export async function POST(req: Request, { params }: Params) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    const { id } = await params;
    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket || ticket.tenantId !== session.user.tenantId) throw new AuthError("Ticket not found", 404);
    if (ticket.requesterId !== session.user.id) throw new AuthError("Only the requester can rate this ticket", 403);
    if (ticket.status !== "RESOLVED" && ticket.status !== "CLOSED") {
      throw new AuthError("Ticket isn't resolved yet", 400);
    }

    const existing = await prisma.ticketSatisfaction.findUnique({ where: { ticketId: id } });
    if (existing) throw new AuthError("Already rated", 400);

    const { rating, comment } = bodySchema.parse(await req.json());
    return prisma.ticketSatisfaction.create({
      data: { ticketId: id, rating, comment },
    });
  });
}
