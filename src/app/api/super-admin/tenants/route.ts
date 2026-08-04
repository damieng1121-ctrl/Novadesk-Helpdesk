import { z } from "zod";
import { requireRole } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function GET() {
  return withApiErrors(async () => {
    await requireRole(["SUPER_ADMIN"]);
    return prisma.tenant.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { users: true, tickets: true } } },
    });
  });
}

const createSchema = z.object({
  name: z.string().min(2).max(150),
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, and hyphens only"),
  domain: z
    .string()
    .min(3)
    .max(150)
    .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i, "Must be a bare domain, e.g. school-name.sch.uk"),
  phase: z.enum(["NURSERY", "PRIMARY", "SECONDARY", "ALL_THROUGH", "SPECIAL", "MULTI_ACADEMY_TRUST"]),
  urn: z.string().max(20).optional(),
});

export async function POST(req: Request) {
  return withApiErrors(async () => {
    await requireRole(["SUPER_ADMIN"]);
    const body = createSchema.parse(await req.json());
    return prisma.tenant.create({
      data: { ...body, domain: body.domain.toLowerCase(), slug: body.slug.toLowerCase() },
    });
  });
}
