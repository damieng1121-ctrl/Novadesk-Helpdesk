import { requireTenantSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { deleteUpload, readUpload, saveUserAvatar, UploadTooLargeError } from "@/lib/storage";

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

/** Serves the signed-in user's own self-uploaded avatar. */
export async function GET() {
  const session = await requireTenantSession().catch(() => null);
  if (!session) return new Response("Not authenticated", { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { avatarUrl: true } });
  if (!user?.avatarUrl) return new Response("No avatar set", { status: 404 });

  const bytes = await readUpload(user.avatarUrl).catch(() => null);
  if (!bytes) return new Response("File not found", { status: 404 });

  const ext = user.avatarUrl.split(".").pop()?.toLowerCase() ?? "";
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
      "Cache-Control": "private, max-age=300",
    },
  });
}

export async function POST(req: Request) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new AuthError("No file provided", 400);
    if (!ALLOWED_TYPES.has(file.type)) throw new AuthError("Avatar must be a PNG, JPEG, WebP, or GIF image", 400);

    const existing = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id }, select: { avatarUrl: true } });
    if (existing.avatarUrl) await deleteUpload(existing.avatarUrl);

    let saved;
    try {
      const bytes = Buffer.from(await file.arrayBuffer());
      saved = await saveUserAvatar(session.user.id, file.name, bytes);
    } catch (err) {
      if (err instanceof UploadTooLargeError) throw new AuthError(err.message, 413);
      throw err;
    }

    return prisma.user.update({ where: { id: session.user.id }, data: { avatarUrl: saved.key }, select: { avatarUrl: true } });
  });
}

export async function DELETE() {
  return withApiErrors(async () => {
    const session = await requireTenantSession();

    const existing = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id }, select: { avatarUrl: true } });
    if (existing.avatarUrl) await deleteUpload(existing.avatarUrl);

    return prisma.user.update({ where: { id: session.user.id }, data: { avatarUrl: null }, select: { avatarUrl: true } });
  });
}
