import { z } from "zod";
import { requireTenantSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/roles";

export async function GET() {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    return prisma.tenant.findUniqueOrThrow({ where: { id: session.user.tenantId } });
  });
}

const bodySchema = z.object({
  name: z.string().min(2).max(150).optional(),
  logoUrl: z.string().url().optional().or(z.literal("")),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  urn: z.string().max(20).optional(),
  outOfHoursEnabled: z.boolean().optional(),
  outOfHoursStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  outOfHoursEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  outOfHoursWeekendOnly: z.boolean().optional(),
  outOfHoursMessage: z.string().min(1).max(1000).optional(),
});

export async function PATCH(req: Request) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!isAdmin(session.user.role)) throw new AuthError("Only admins can update school details", 403);
    const body = bodySchema.parse(await req.json());
    return prisma.tenant.update({
      where: { id: session.user.tenantId },
      data: { ...body, logoUrl: body.logoUrl || undefined },
    });
  });
}
