import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { requireTenantSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { canManageTickets, isAdmin } from "@/lib/roles";
import { createTicket } from "@/lib/tickets";

export async function GET(req: Request) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const assignee = searchParams.get("assignee"); // "me" | "unassigned" | null
    const categoryId = searchParams.get("categoryId");
    const search = searchParams.get("q");
    const numberFilter = searchParams.get("number");

    const where: Prisma.TicketWhereInput = { tenantId: session.user.tenantId, isDeleted: false };
    // Collected as AND-ed sub-clauses rather than reusing `where.OR` directly,
    // since both the requester/company scope below and the search clause
    // need their own OR — assigning to `where.OR` twice would silently drop
    // the first one.
    const conditions: Prisma.TicketWhereInput[] = [];

    // Requesters see their own tickets plus any raised by a colleague in the
    // same Company (e.g. other staff at their school) — never anyone else's.
    if (!canManageTickets(session.user.role)) {
      conditions.push(
        session.user.companyId
          ? { OR: [{ requesterId: session.user.id }, { requester: { companyId: session.user.companyId } }] }
          : { requesterId: session.user.id },
      );
    } else {
      if (assignee === "me") where.assigneeId = session.user.id;
      if (assignee === "unassigned") where.assigneeId = null;

      // A Technician (never an Admin) assigned to one or more Brands only
      // sees that Brand's tickets, plus any ticket with no Brand at all —
      // this is a queue-organisation default, not a hard security wall.
      if (!isAdmin(session.user.role)) {
        const me = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { technicianBrands: { select: { id: true } } },
        });
        const brandIds = me?.technicianBrands.map((b) => b.id) ?? [];
        if (brandIds.length > 0) {
          conditions.push({ OR: [{ brandId: { in: brandIds } }, { brandId: null }] });
        }
      }
    }

    if (status) where.status = status as Prisma.EnumTicketStatusFilter["equals"];
    if (categoryId) where.categoryId = categoryId;
    const brandFilter = searchParams.get("brandId");
    if (brandFilter) where.brandId = brandFilter;
    const companyFilter = searchParams.get("companyId");
    if (companyFilter) where.companyId = companyFilter;
    if (numberFilter && !Number.isNaN(Number(numberFilter))) where.number = Number(numberFilter);
    if (searchParams.get("outOfHours") === "true") where.isOutOfHours = true;
    if (search) {
      conditions.push({
        OR: [
          { subject: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ],
      });
    }
    if (conditions.length) where.AND = conditions;

    const tickets = await prisma.ticket.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        category: true,
        brand: { select: { id: true, name: true } },
        company: { select: { id: true, name: true } },
        requester: { select: { id: true, name: true, email: true } },
        assignee: { select: { id: true, name: true, email: true } },
      },
    });
    return tickets;
  });
}

const createSchema = z.object({
  subject: z.string().min(3).max(150),
  description: z.string().min(1).max(5000),
  categoryId: z.string().optional(),
  brandId: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  type: z.enum(["PROBLEM", "INCIDENT", "REQUEST", "INFORMATION", "TRAINING", "QUOTE"]).optional(),
  /** Staff-only: raise this ticket on someone else's behalf (e.g. logging a phone call). */
  requesterId: z.string().optional(),
  /** Staff-only: assign the ticket to a Company directly, overriding the requester's own default. */
  companyId: z.string().optional(),
});

export async function POST(req: Request) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    const { requesterId: onBehalfOfId, companyId: companyOverride, ...body } = createSchema.parse(await req.json());

    let requesterId = session.user.id;
    if (onBehalfOfId && onBehalfOfId !== session.user.id) {
      if (!canManageTickets(session.user.role)) {
        throw new AuthError("Only helpdesk staff can raise a ticket on someone else's behalf", 403);
      }
      const target = await prisma.user.findUnique({ where: { id: onBehalfOfId } });
      if (!target || target.tenantId !== session.user.tenantId) throw new AuthError("Requester not found", 404);
      requesterId = target.id;
    }

    let companyId: string | undefined;
    if (companyOverride) {
      if (!canManageTickets(session.user.role)) {
        throw new AuthError("Only helpdesk staff can assign a ticket to a company", 403);
      }
      const company = await prisma.company.findUnique({ where: { id: companyOverride } });
      if (!company || company.tenantId !== session.user.tenantId) throw new AuthError("Company not found", 404);
      companyId = company.id;
    }

    return createTicket({ ...body, tenantId: session.user.tenantId, requesterId, companyId, actorId: session.user.id });
  });
}
