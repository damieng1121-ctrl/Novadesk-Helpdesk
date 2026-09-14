import { requireTenantSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/roles";
import { getNotificationProvider } from "@/lib/notifications";

const STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  COMPLIANT: "Compliant",
  NON_COMPLIANT: "Non-compliant",
  NOT_APPLICABLE: "Not applicable",
};

/** Emails the current DfE compliance report to the requesting user's own address. */
export async function POST() {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!isAdmin(session.user.role) && session.user.role !== "AGENT") {
      throw new AuthError("Only helpdesk staff can email the compliance report", 403);
    }
    const recipientEmail = session.user.email;
    if (!recipientEmail) throw new AuthError("Your account has no email address on file", 400);

    const [tenant, standards, assessments] = await Promise.all([
      prisma.tenant.findUniqueOrThrow({ where: { id: session.user.tenantId } }),
      prisma.complianceStandard.findMany({
        orderBy: { order: "asc" },
        include: { items: { orderBy: { order: "asc" } } },
      }),
      prisma.complianceAssessment.findMany({ where: { tenantId: session.user.tenantId } }),
    ]);

    const assessmentByItem = new Map(assessments.map((a) => [a.itemId, a]));
    const allItems = standards.flatMap((s) => s.items);
    const compliantCount = allItems.filter((i) => assessmentByItem.get(i.id)?.status === "COMPLIANT").length;
    const overallPct = allItems.length ? Math.round((compliantCount / allItems.length) * 100) : 0;

    const lines: string[] = [];
    lines.push(`DfE Digital & Technology Standards — Compliance Report`);
    lines.push(`${tenant.name}`);
    lines.push(`Generated: ${new Date().toLocaleString("en-GB", { timeZone: tenant.timezone })}`);
    lines.push("");
    lines.push(`Overall readiness: ${compliantCount}/${allItems.length} standards met (${overallPct}%)`);
    lines.push("");

    for (const standard of standards) {
      const standardCompliant = standard.items.filter((i) => assessmentByItem.get(i.id)?.status === "COMPLIANT").length;
      lines.push(`== ${standard.title} (${standardCompliant}/${standard.items.length} met) ==`);
      for (const item of standard.items) {
        const assessment = assessmentByItem.get(item.id);
        const status = STATUS_LABEL[assessment?.status ?? "NOT_STARTED"];
        const reviewDue = assessment?.nextReviewDue
          ? new Date(assessment.nextReviewDue).toLocaleDateString("en-GB")
          : "not set";
        lines.push(`  [${status}] ${item.title} (${item.priority} priority)`);
        lines.push(`    Next review due: ${reviewDue}`);
        if (assessment?.evidenceNotes) lines.push(`    Evidence/notes: ${assessment.evidenceNotes}`);
        if (assessment?.evidenceUrl) lines.push(`    Evidence URL: ${assessment.evidenceUrl}`);
      }
      lines.push("");
    }

    lines.push(
      "This is a working self-assessment, not an official DfE certification. Always check the latest guidance at https://www.gov.uk/guidance/meeting-digital-and-technology-standards-in-schools-and-colleges before reporting compliance externally.",
    );

    const notifications = getNotificationProvider();
    await notifications.send({
      to: recipientEmail,
      subject: `${tenant.name} — DfE compliance report (${overallPct}% ready)`,
      text: lines.join("\n"),
    });

    await prisma.auditLog.create({
      data: {
        tenantId: session.user.tenantId,
        userId: session.user.id,
        action: "compliance.report_emailed",
        entityType: "ComplianceStandard",
        metadata: { overallPct, compliantCount, totalItems: allItems.length },
      },
    });

    return { sent: true, to: recipientEmail };
  });
}
