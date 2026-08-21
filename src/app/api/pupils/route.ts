import { z } from "zod";
import { requireMisSession } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

const YEAR_GROUPS = [
  "NURSERY", "RECEPTION", "YEAR_1", "YEAR_2", "YEAR_3", "YEAR_4", "YEAR_5",
  "YEAR_6", "YEAR_7", "YEAR_8", "YEAR_9", "YEAR_10", "YEAR_11", "YEAR_12", "YEAR_13",
] as const;

export async function GET(req: Request) {
  return withApiErrors(async () => {
    const session = await requireMisSession();
    const { searchParams } = new URL(req.url);
    const formGroupId = searchParams.get("formGroupId");
    const search = searchParams.get("search");

    const where: Prisma.PupilWhereInput = { tenantId: session.user.tenantId, isDeleted: false };
    if (formGroupId) where.formGroupId = formGroupId;
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { preferredName: { contains: search, mode: "insensitive" } },
      ];
    }

    return prisma.pupil.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      include: { formGroup: { select: { id: true, name: true } } },
    });
  });
}

const createSchema = z.object({
  upn: z.string().max(20).optional(),
  admissionNumber: z.string().max(30).optional(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  preferredName: z.string().max(100).optional(),
  dob: z.coerce.date(),
  gender: z.enum(["MALE", "FEMALE"]),
  formGroupId: z.string().min(1).optional(),
  yearGroup: z.enum(YEAR_GROUPS),
  ethnicity: z.string().max(100).optional(),
  homeLanguage: z.string().max(100).optional(),
  addressLine1: z.string().max(200).optional(),
  addressLine2: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  postcode: z.string().max(20).optional(),
  sendStatus: z.enum(["NONE", "SEND_SUPPORT", "EHCP"]).optional(),
  pupilPremium: z.boolean().optional(),
  freeSchoolMeals: z.boolean().optional(),
  admissionDate: z.coerce.date().optional(),
  medicalNotes: z.string().max(4000).optional(),
});

export async function POST(req: Request) {
  return withApiErrors(async () => {
    const session = await requireMisSession();
    const body = createSchema.parse(await req.json());

    return prisma.pupil.create({
      data: { ...body, tenantId: session.user.tenantId },
      include: { formGroup: { select: { id: true, name: true } } },
    });
  });
}
