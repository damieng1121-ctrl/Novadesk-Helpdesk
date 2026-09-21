import { z } from "zod";
import { requireTenantSession } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";

const selectFields = {
  id: true,
  name: true,
  email: true,
  jobTitle: true,
  phone: true,
  signature: true,
  image: true,
  avatarUrl: true,
} as const;

export async function GET() {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    return prisma.user.findUniqueOrThrow({ where: { id: session.user.id }, select: selectFields });
  });
}

const updateSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  jobTitle: z.string().trim().max(150).nullable().optional(),
  phone: z.string().trim().max(50).nullable().optional(),
  signature: z.string().trim().max(2000).nullable().optional(),
});

export async function PATCH(req: Request) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    const body = updateSchema.parse(await req.json());
    return prisma.user.update({ where: { id: session.user.id }, data: body, select: selectFields });
  });
}
