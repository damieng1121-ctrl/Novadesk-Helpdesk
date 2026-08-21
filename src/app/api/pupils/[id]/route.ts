import { z } from "zod";
import { requireMisSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/roles";

type Params = { params: Promise<{ id: string }> };

const YEAR_GROUPS = [
  "NURSERY", "RECEPTION", "YEAR_1", "YEAR_2", "YEAR_3", "YEAR_4", "YEAR_5",
  "YEAR_6", "YEAR_7", "YEAR_8", "YEAR_9", "YEAR_10", "YEAR_11", "YEAR_12", "YEAR_13",
] as const;

export async function GET(_req: Request, { params }: Params) {
  return withApiErrors(async () => {
    const session = await requireMisSession();
    const { id } = await params;

    const pupil = await prisma.pupil.findUnique({
      where: { id },
      include: { formGroup: { select: { id: true, name: true, academicYearId: true } } },
    });
    if (!pupil || pupil.tenantId !== session.user.tenantId) throw new AuthError("Not found", 404);

    return pupil;
  });
}

const updateSchema = z.object({
  upn: z.string().max(20).nullable().optional(),
  admissionNumber: z.string().max(30).nullable().optional(),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  preferredName: z.string().max(100).nullable().optional(),
  dob: z.coerce.date().optional(),
  gender: z.enum(["MALE", "FEMALE"]).optional(),
  formGroupId: z.string().min(1).nullable().optional(),
  yearGroup: z.enum(YEAR_GROUPS).optional(),
  ethnicity: z.string().max(100).nullable().optional(),
  homeLanguage: z.string().max(100).nullable().optional(),
  addressLine1: z.string().max(200).nullable().optional(),
  addressLine2: z.string().max(200).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  postcode: z.string().max(20).nullable().optional(),
  sendStatus: z.enum(["NONE", "SEND_SUPPORT", "EHCP"]).optional(),
  pupilPremium: z.boolean().optional(),
  freeSchoolMeals: z.boolean().optional(),
  admissionDate: z.coerce.date().nullable().optional(),
  leavingDate: z.coerce.date().nullable().optional(),
  medicalNotes: z.string().max(4000).nullable().optional(),
  photoUrl: z.string().max(2000).nullable().optional(),
  isActive: z.boolean().optional(),
  isDeleted: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: Params) {
  return withApiErrors(async () => {
    const session = await requireMisSession();
    const { id } = await params;

    const pupil = await prisma.pupil.findUnique({ where: { id } });
    if (!pupil || pupil.tenantId !== session.user.tenantId) throw new AuthError("Not found", 404);

    const body = updateSchema.parse(await req.json());
    if (body.isDeleted !== undefined && !isAdmin(session.user.role)) {
      throw new AuthError("Only admins can delete or restore pupils", 403);
    }

    return prisma.pupil.update({
      where: { id },
      data: body,
      include: { formGroup: { select: { id: true, name: true } } },
    });
  });
}

/** Permanent, unrecoverable delete — only ever reachable from the trash bin on an already soft-deleted pupil. */
export async function DELETE(_req: Request, { params }: Params) {
  return withApiErrors(async () => {
    const session = await requireMisSession();
    if (!isAdmin(session.user.role)) throw new AuthError("Only admins can permanently delete pupils", 403);
    const { id } = await params;

    const pupil = await prisma.pupil.findUnique({ where: { id } });
    if (!pupil || pupil.tenantId !== session.user.tenantId) throw new AuthError("Not found", 404);
    if (!pupil.isDeleted) throw new AuthError("Move to trash before permanently deleting", 400);

    await prisma.pupil.delete({ where: { id } });
    return { ok: true };
  });
}
