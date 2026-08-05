import { z } from "zod";
import { requireTenantSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/roles";

export async function GET() {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!isAdmin(session.user.role)) throw new AuthError("Only admins can view users", 403);
    return prisma.user.findMany({
      where: { tenantId: session.user.tenantId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        twoFactorEnabled: true,
        createdAt: true,
        _count: { select: { accounts: true } },
      },
    });
  });
}

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  name: z.string().trim().max(150).optional(),
  role: z.enum(["REQUESTER", "AGENT", "TENANT_ADMIN"]),
});

/**
 * Pre-provisions a user row for this tenant so the invited person lands in
 * the right school/role the moment they first sign in with Google — see
 * signIn/jwt in src/lib/auth.ts, which honour an existing tenantId instead
 * of re-deriving it from the email's domain.
 */
export async function POST(req: Request) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!isAdmin(session.user.role)) throw new AuthError("Only admins can invite users", 403);
    const body = inviteSchema.parse(await req.json());
    const email = body.email.toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      // Never let a tenant admin retarget the platform super admin, or
      // pull a user out of another school without that school's consent.
      if (existing.role === "SUPER_ADMIN") throw new AuthError("This email is reserved", 409);
      if (existing.tenantId && existing.tenantId !== session.user.tenantId) {
        throw new AuthError("This email is already assigned to another school", 409);
      }
      const user = await prisma.user.update({
        where: { id: existing.id },
        data: { tenantId: session.user.tenantId, role: body.role, name: body.name ?? existing.name },
      });
      return user;
    }

    const user = await prisma.user.create({
      data: { email, name: body.name, role: body.role, tenantId: session.user.tenantId },
    });

    await prisma.auditLog.create({
      data: {
        tenantId: session.user.tenantId,
        userId: session.user.id,
        action: "user.invited",
        entityType: "User",
        entityId: user.id,
        metadata: { email, role: body.role },
      },
    });

    return user;
  });
}
