import { z } from "zod";
import { requireMisSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

const createSchema = z.object({
  note: z.string().min(1).max(4000),
});

export async function POST(req: Request, { params }: Params) {
  return withApiErrors(async () => {
    const session = await requireMisSession();
    const { id } = await params;

    const intervention = await prisma.intervention.findUnique({ where: { id } });
    if (!intervention || intervention.tenantId !== session.user.tenantId) throw new AuthError("Not found", 404);

    const body = createSchema.parse(await req.json());

    return prisma.interventionNote.create({
      data: {
        note: body.note,
        tenantId: session.user.tenantId,
        interventionId: id,
        authorId: session.user.id,
      },
      include: { author: { select: { name: true, email: true } } },
    });
  });
}
