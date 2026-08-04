import { requireTenantSession } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";

/**
 * Returns the full DfE digital & technology standards catalogue, each item
 * annotated with this tenant's current assessment (or a NOT_STARTED
 * default if one doesn't exist yet).
 */
export async function GET() {
  return withApiErrors(async () => {
    const session = await requireTenantSession();

    const [standards, assessments] = await Promise.all([
      prisma.complianceStandard.findMany({
        orderBy: { order: "asc" },
        include: { items: { orderBy: { order: "asc" } } },
      }),
      prisma.complianceAssessment.findMany({ where: { tenantId: session.user.tenantId } }),
    ]);

    const assessmentByItem = new Map(assessments.map((a) => [a.itemId, a]));

    return standards.map((standard) => ({
      ...standard,
      items: standard.items.map((item) => ({
        ...item,
        assessment: assessmentByItem.get(item.id) ?? {
          status: "NOT_STARTED" as const,
          evidenceNotes: null,
          evidenceUrl: null,
          nextReviewDue: null,
          reviewedAt: null,
        },
      })),
    }));
  });
}
