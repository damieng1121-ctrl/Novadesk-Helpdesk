import { requireTenantSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/roles";
import { deleteUpload, saveTenantLogo, UploadTooLargeError } from "@/lib/storage";

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/svg+xml", "image/webp", "image/gif"]);

export async function POST(req: Request) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!isAdmin(session.user.role)) throw new AuthError("Only admins can update the school logo", 403);

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new AuthError("No file provided", 400);
    if (!ALLOWED_TYPES.has(file.type)) throw new AuthError("Logo must be a PNG, JPEG, SVG, WebP, or GIF image", 400);

    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: session.user.tenantId } });
    if (tenant.logoUrl) await deleteUpload(tenant.logoUrl);

    let saved;
    try {
      const bytes = Buffer.from(await file.arrayBuffer());
      saved = await saveTenantLogo(session.user.tenantId, file.name, bytes);
    } catch (err) {
      if (err instanceof UploadTooLargeError) throw new AuthError(err.message, 413);
      throw err;
    }

    return prisma.tenant.update({ where: { id: session.user.tenantId }, data: { logoUrl: saved.key } });
  });
}

export async function DELETE() {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!isAdmin(session.user.role)) throw new AuthError("Only admins can update the school logo", 403);

    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: session.user.tenantId } });
    if (tenant.logoUrl) await deleteUpload(tenant.logoUrl);

    return prisma.tenant.update({ where: { id: session.user.tenantId }, data: { logoUrl: null } });
  });
}
