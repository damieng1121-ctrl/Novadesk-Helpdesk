import { requireTenantSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { canManageTickets } from "@/lib/roles";
import { readUpload } from "@/lib/storage";

type Params = { params: Promise<{ id: string; attachmentId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const session = await requireTenantSession().catch(() => null);
  if (!session) return new Response("Not authenticated", { status: 401 });

  const { id: ticketId, attachmentId } = await params;
  const staff = canManageTickets(session.user.role);

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket || ticket.tenantId !== session.user.tenantId) return new Response("Not found", { status: 404 });
  if (!staff && ticket.requesterId !== session.user.id) return new Response("Not found", { status: 404 });

  const attachment = await prisma.ticketAttachment.findUnique({
    where: { id: attachmentId },
    include: { comment: true },
  });
  if (!attachment || attachment.ticketId !== ticketId) return new Response("Not found", { status: 404 });
  if (attachment.comment?.isInternal && !staff) return new Response("Not found", { status: 404 });

  const bytes = await readUpload(attachment.url).catch(() => null);
  if (!bytes) return new Response("File not found", { status: 404 });

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": attachment.contentType || "application/octet-stream",
      "Content-Disposition": `inline; filename="${attachment.fileName.replace(/"/g, "")}"`,
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}
