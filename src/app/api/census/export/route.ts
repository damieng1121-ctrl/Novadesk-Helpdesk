import { NextResponse } from "next/server";
import { requireMisSession, AuthError } from "@/lib/session";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/roles";

const HEADERS = [
  "UPN",
  "Admission Number",
  "First Name",
  "Last Name",
  "DOB",
  "Gender",
  "Year Group",
  "Ethnicity",
  "Home Language",
  "Postcode",
  "SEND Status",
  "Pupil Premium",
  "Free School Meals",
  "Admission Date",
];

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function formatDate(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

export async function GET() {
  let session;
  try {
    session = await requireMisSession();
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
  if (!isAdmin(session.user.role)) {
    return NextResponse.json({ error: "This area is only available to school admins" }, { status: 403 });
  }

  const pupils = await prisma.pupil.findMany({
    where: { tenantId: session.user.tenantId, isActive: true, isDeleted: false },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const rows = pupils.map((p) =>
    [
      p.upn ?? "",
      p.admissionNumber ?? "",
      p.firstName,
      p.lastName,
      formatDate(p.dob),
      p.gender,
      p.yearGroup,
      p.ethnicity ?? "",
      p.homeLanguage ?? "",
      p.postcode ?? "",
      p.sendStatus,
      p.pupilPremium ? "Yes" : "No",
      p.freeSchoolMeals ? "Yes" : "No",
      formatDate(p.admissionDate),
    ]
      .map((v) => csvEscape(String(v)))
      .join(","),
  );

  const csv = [HEADERS.join(","), ...rows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="census-export.csv"',
    },
  });
}
