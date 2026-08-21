import { z } from "zod";
import { requireParentSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function GET() {
  return withApiErrors(async () => {
    const session = await requireParentSession();

    const recipients = await prisma.parentMessageRecipient.findMany({
      where: { tenantId: session.user.tenantId, guardianId: session.user.id },
      orderBy: { message: { sentAt: "desc" } },
      include: {
        message: {
          select: { id: true, subject: true, body: true, sentAt: true, sender: { select: { name: true, email: true } } },
        },
      },
    });

    return recipients;
  });
}

const markReadSchema = z.object({ id: z.string().min(1) });

export async function PATCH(req: Request) {
  return withApiErrors(async () => {
    const session = await requireParentSession();
    const { searchParams } = new URL(req.url);
    const { id } = markReadSchema.parse({ id: searchParams.get("id") });

    const recipient = await prisma.parentMessageRecipient.findUnique({ where: { id } });
    if (!recipient || recipient.tenantId !== session.user.tenantId || recipient.guardianId !== session.user.id) {
      throw new AuthError("Not found", 404);
    }

    return prisma.parentMessageRecipient.update({ where: { id }, data: { readAt: new Date() } });
  });
}
