import { requireMisSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/roles";

const CHECKED_FIELDS = ["upn", "dob", "gender", "ethnicity", "postcode", "admissionDate"] as const;

export async function GET() {
  return withApiErrors(async () => {
    const session = await requireMisSession();
    if (!isAdmin(session.user.role)) throw new AuthError("This area is only available to school admins", 403);
    const tenantId = session.user.tenantId;

    const pupils = await prisma.pupil.findMany({
      where: { tenantId, isActive: true, isDeleted: false },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        yearGroup: true,
        upn: true,
        dob: true,
        gender: true,
        ethnicity: true,
        postcode: true,
        admissionDate: true,
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });

    const issuesByField: Record<(typeof CHECKED_FIELDS)[number], number> = {
      upn: 0,
      dob: 0,
      gender: 0,
      ethnicity: 0,
      postcode: 0,
      admissionDate: 0,
    };
    const pupilsWithIssues: { id: string; name: string; yearGroup: string; missingFields: string[] }[] = [];

    for (const p of pupils) {
      const missingFields: string[] = [];
      // 13 characters is the DfE UPN length; a mismatch is still flagged but treated the same as missing.
      if (!p.upn || p.upn.trim().length !== 13) missingFields.push("upn");
      if (!p.dob) missingFields.push("dob");
      if (!p.gender) missingFields.push("gender");
      if (!p.ethnicity || p.ethnicity.trim().length === 0) missingFields.push("ethnicity");
      if (!p.postcode || p.postcode.trim().length === 0) missingFields.push("postcode");
      if (!p.admissionDate) missingFields.push("admissionDate");

      for (const field of missingFields) issuesByField[field as (typeof CHECKED_FIELDS)[number]] += 1;
      if (missingFields.length > 0) {
        pupilsWithIssues.push({
          id: p.id,
          name: `${p.firstName} ${p.lastName}`,
          yearGroup: p.yearGroup,
          missingFields,
        });
      }
    }

    return {
      totalPupils: pupils.length,
      pupilsWithIssues: pupilsWithIssues.length,
      issuesByField,
      pupils: pupilsWithIssues,
    };
  });
}
