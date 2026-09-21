import { z } from "zod";
import { requireTenantSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { canManageTickets, isAdmin } from "@/lib/roles";
import { encrypt } from "@/lib/crypto";

// Never select encryptedPassword here — the list is metadata only. A
// password is only ever decrypted one at a time via /api/passwords/[id]/reveal.
const listSelect = {
  id: true,
  title: true,
  username: true,
  url: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { name: true, email: true } },
} as const;

export async function GET() {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!canManageTickets(session.user.role)) throw new AuthError("Staff only", 403);
    return prisma.passwordEntry.findMany({
      where: { tenantId: session.user.tenantId },
      orderBy: { title: "asc" },
      select: listSelect,
    });
  });
}

const createSchema = z.object({
  title: z.string().trim().min(1).max(150),
  username: z.string().trim().max(150).optional(),
  password: z.string().min(1).max(500),
  url: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export async function POST(req: Request) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!isAdmin(session.user.role)) throw new AuthError("Only admins can add password entries", 403);
    const body = createSchema.parse(await req.json());
    const entry = await prisma.passwordEntry.create({
      data: {
        tenantId: session.user.tenantId,
        title: body.title,
        username: body.username,
        encryptedPassword: encrypt(body.password),
        url: body.url,
        notes: body.notes,
        createdById: session.user.id,
      },
      select: listSelect,
    });
    await prisma.auditLog.create({
      data: {
        tenantId: session.user.tenantId,
        userId: session.user.id,
        action: "password.created",
        entityType: "PasswordEntry",
        entityId: entry.id,
        metadata: { title: entry.title },
      },
    });
    return entry;
  });
}
