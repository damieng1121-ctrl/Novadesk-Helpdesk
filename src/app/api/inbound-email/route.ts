import { prisma } from "@/lib/db";
import { createTicket } from "@/lib/tickets";
import { notifyNewComment } from "@/lib/notifications/events";

/**
 * Inbound email-to-ticket webhook — point Postmark's (or Mailgun's) inbound
 * parse webhook at this URL with ?token=<INBOUND_EMAIL_WEBHOOK_TOKEN> to let
 * helpdesk@yourdomain create/reply to tickets by email. There's no request
 * signature to verify (Postmark doesn't sign inbound payloads by default),
 * so the shared-secret query token IS the auth boundary — keep it secret
 * and only ever put it in the provider's webhook URL config, never in a
 * client-visible place.
 *
 * Expects Postmark's inbound JSON shape: FromFull.Email, OriginalRecipient,
 * Subject, TextBody/HtmlBody. See https://postmarkapp.com/developer/webhooks/inbound-webhook
 */

type PostmarkInboundPayload = {
  FromFull?: { Email?: string; Name?: string };
  From?: string;
  OriginalRecipient?: string;
  Subject?: string;
  TextBody?: string;
  HtmlBody?: string;
};

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (!process.env.INBOUND_EMAIL_WEBHOOK_TOKEN || token !== process.env.INBOUND_EMAIL_WEBHOOK_TOKEN) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: PostmarkInboundPayload;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const fromEmail = (payload.FromFull?.Email ?? payload.From ?? "").trim().toLowerCase();
  if (!fromEmail) return Response.json({ error: "No From address" }, { status: 400 });

  const subject = payload.Subject?.trim() || "(no subject)";
  const description = (payload.TextBody?.trim() || stripHtml(payload.HtmlBody ?? "")) || "(no message body)";
  const originalRecipient = payload.OriginalRecipient?.trim().toLowerCase();

  const tenant = await prisma.tenant.findFirst();
  if (!tenant) return Response.json({ error: "No tenant configured" }, { status: 500 });

  let requester = await prisma.user.findUnique({ where: { email: fromEmail } });
  if (!requester) {
    // Try to auto-match a Company by the sender's email domain (e.g.
    // teacher@willowbrook.example -> a Company with domain
    // "willowbrook.example") so a brand-new inbound-email ticket isn't
    // left uncategorised in reporting the way it would be otherwise.
    const senderDomain = fromEmail.split("@")[1];
    const matchedCompany = senderDomain
      ? await prisma.company.findFirst({ where: { tenantId: tenant.id, domain: senderDomain } })
      : null;

    // A brand-new emailer becomes a ticket requester, not a portal login —
    // see portalAccessGranted's doc comment on the User model.
    requester = await prisma.user.create({
      data: {
        email: fromEmail,
        name: payload.FromFull?.Name || undefined,
        role: "REQUESTER",
        tenantId: tenant.id,
        companyId: matchedCompany?.id,
        portalAccessGranted: false,
      },
    });
  }

  const brand = originalRecipient
    ? await prisma.brand.findFirst({ where: { tenantId: tenant.id, supportEmail: originalRecipient } })
    : null;

  // A reply to an existing ticket carries its number in the subject line —
  // every outbound notification already includes "#<number>" (see
  // notifyTicketCreated/notifyNewComment), and most mail clients preserve
  // the original subject under a "Re:" prefix.
  const ticketNumberMatch = subject.match(/#(\d+)/);
  if (ticketNumberMatch) {
    const ticket = await prisma.ticket.findFirst({
      where: { tenantId: tenant.id, number: Number(ticketNumberMatch[1]), isDeleted: false },
    });
    if (ticket) {
      await prisma.ticketComment.create({
        data: { ticketId: ticket.id, authorId: requester.id, body: description, isInternal: false },
      });
      if (ticket.requesterId === requester.id && (ticket.status === "RESOLVED" || ticket.status === "CLOSED")) {
        await prisma.ticket.update({
          where: { id: ticket.id },
          data: { status: "OPEN", resolvedAt: null, closedAt: null },
        });
      }
      await notifyNewComment(ticket, requester.id, false);
      return Response.json({ ok: true, ticketId: ticket.id, action: "commented" });
    }
    // Fall through to creating a new ticket if #N didn't match a real ticket.
  }

  const ticket = await createTicket({
    tenantId: tenant.id,
    requesterId: requester.id,
    subject,
    description,
    brandId: brand?.id,
  });
  return Response.json({ ok: true, ticketId: ticket.id, action: "created" });
}
