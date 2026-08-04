import { requireTenantSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { canManageTickets } from "@/lib/roles";
import { saveUpload, UploadTooLargeError } from "@/lib/storage";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    const { id: ticketId } = await params;
    const staff = canManageTickets(session.user.role);

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket || ticket.tenantId !== session.user.tenantId) throw new AuthError("Ticket not found", 404);
    if (!staff && ticket.requesterId !== session.user.id) throw new AuthError("Ticket not found", 404);

    const form = await req.formData();
    const file = form.get("file");
    const commentId = form.get("commentId");
    if (!(file instanceof File)) throw new AuthError("No file provided", 400);

    if (typeof commentId === "string" && commentId) {
      const comment = await prisma.ticketComment.findUnique({ where: { id: commentId } });
      if (!comment || comment.ticketId !== ticketId) throw new AuthError("Comment not found", 404);
      if (comment.isInternal && !staff) throw new AuthError("Comment not found", 404);
    }

    let saved;
    try {
      const bytes = Buffer.from(await file.arrayBuffer());
      saved = await saveUpload(session.user.tenantId, ticketId, file.name, bytes);
    } catch (err) {
      if (err instanceof UploadTooLargeError) throw new AuthError(err.message, 413);
      throw err;
    }

    const attachment = await prisma.ticketAttachment.create({
      data: {
        ticketId,
        commentId: typeof commentId === "string" && commentId ? commentId : null,
        fileName: file.name,
        url: saved.key,
        fileSize: saved.size,
        contentType: file.type || null,
      },
    });

    return attachment;
  });
}
