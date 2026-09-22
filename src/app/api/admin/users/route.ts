import { z } from "zod";
import { requireTenantSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/roles";
import { notifyUserInvited } from "@/lib/notifications/events";

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
        companyId: true,
        company: { select: { id: true, name: true } },
        _count: { select: { accounts: true } },
      },
    });
  });
}

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  name: z.string().trim().max(150).optional(),
  role: z.enum(["REQUESTER", "AGENT", "TENANT_ADMIN"]),
  companyId: z.string().nullable().optional(),
});

/**
 * Pre-provisions a user row so the invited person lands with the right
 * role (and Company, if given) the moment they first sign in with Google —
 * see signIn/jwt in src/lib/auth.ts, which only ever allow sign-in for an
 * email that already has a row here. There's no domain-based
 * auto-provisioning any more: this invite is the only way in.
 */
export async function POST(req: Request) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!isAdmin(session.user.role)) throw new AuthError("Only admins can invite users", 403);
    const body = inviteSchema.parse(await req.json());
    const email = body.email;

    if (body.companyId) {
      const company = await prisma.company.findUnique({ where: { id: body.companyId } });
      if (!company || company.tenantId !== session.user.tenantId) throw new AuthError("Company not found", 404);
    }

    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: session.user.tenantId }, select: { name: true } });

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      if (existing.role === "SUPER_ADMIN") throw new AuthError("This email is reserved", 409);
      const user = await prisma.user.update({
        where: { id: existing.id },
        data: {
          tenantId: session.user.tenantId,
          role: body.role,
          name: body.name ?? existing.name,
          companyId: body.companyId ?? existing.companyId,
          // An admin explicitly inviting this email is exactly the decision
          // that grants portal access — flips it true even if this row was
          // only an email-to-ticket contact until now (see auth.ts signIn).
          portalAccessGranted: true,
        },
      });
      await notifyUserInvited(user.email, user.name, tenant.name);
      return user;
    }

    const user = await prisma.user.create({
      data: { email, name: body.name, role: body.role, tenantId: session.user.tenantId, companyId: body.companyId },
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

    await notifyUserInvited(user.email, user.name, tenant.name);
    return user;
  });
}
