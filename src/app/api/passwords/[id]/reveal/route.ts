import { requireTenantSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { canManageTickets } from "@/lib/roles";
import { decrypt } from "@/lib/crypto";

type Params = { params: Promise<{ id: string }> };

/** Decrypts and returns exactly one password, on demand — never bundled into the list response. Every reveal is audit-logged. */
export async function GET(_req: Request, { params }: Params) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!canManageTickets(session.user.role)) throw new AuthError("Staff only", 403);
    const { id } = await params;
    const entry = await prisma.passwordEntry.findUnique({ where: { id } });
    if (!entry || entry.tenantId !== session.user.tenantId) throw new AuthError("Not found", 404);

    await prisma.auditLog.create({
      data: {
        tenantId: session.user.tenantId,
        userId: session.user.id,
        action: "password.revealed",
        entityType: "PasswordEntry",
        entityId: id,
        metadata: { title: entry.title },
      },
    });

    return { password: decrypt(entry.encryptedPassword) };
  });
}
