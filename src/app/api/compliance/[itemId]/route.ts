import { z } from "zod";
import { requireTenantSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/roles";

type Params = { params: Promise<{ itemId: string }> };

const bodySchema = z.object({
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLIANT", "NON_COMPLIANT", "NOT_APPLICABLE"]),
  evidenceNotes: z.string().max(2000).optional(),
  evidenceUrl: z.string().url().optional().or(z.literal("")),
  nextReviewDue: z.string().optional(), // ISO date
});

export async function PUT(req: Request, { params }: Params) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!isAdmin(session.user.role) && session.user.role !== "AGENT") {
      throw new AuthError("Only helpdesk staff can update compliance status", 403);
    }
    const { itemId } = await params;
    const item = await prisma.complianceItem.findUnique({ where: { id: itemId } });
    if (!item) throw new AuthError("Compliance item not found", 404);

    const body = bodySchema.parse(await req.json());

    const assessment = await prisma.complianceAssessment.upsert({
      where: { tenantId_itemId: { tenantId: session.user.tenantId, itemId } },
      create: {
        tenantId: session.user.tenantId,
        itemId,
        status: body.status,
        evidenceNotes: body.evidenceNotes || null,
        evidenceUrl: body.evidenceUrl || null,
        nextReviewDue: body.nextReviewDue ? new Date(body.nextReviewDue) : null,
        reviewedById: session.user.id,
        reviewedAt: new Date(),
      },
      update: {
        status: body.status,
        evidenceNotes: body.evidenceNotes || null,
        evidenceUrl: body.evidenceUrl || null,
        nextReviewDue: body.nextReviewDue ? new Date(body.nextReviewDue) : null,
        reviewedById: session.user.id,
        reviewedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        tenantId: session.user.tenantId,
        userId: session.user.id,
        action: "compliance.assessed",
        entityType: "ComplianceItem",
        entityId: itemId,
        metadata: { status: body.status },
      },
    });

    return assessment;
  });
}
