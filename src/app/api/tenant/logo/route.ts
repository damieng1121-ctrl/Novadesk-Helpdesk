import { requireTenantSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { readUpload } from "@/lib/storage";

const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  svg: "image/svg+xml",
  webp: "image/webp",
  gif: "image/gif",
};

export async function GET() {
  const session = await requireTenantSession().catch(() => null);
  if (!session) return new Response("Not authenticated", { status: 401 });

  const tenant = await prisma.tenant.findUnique({ where: { id: session.user.tenantId }, select: { logoUrl: true } });
  if (!tenant?.logoUrl) return new Response("No logo set", { status: 404 });

  const bytes = await readUpload(tenant.logoUrl).catch(() => null);
  if (!bytes) return new Response("File not found", { status: 404 });

  const ext = tenant.logoUrl.split(".").pop()?.toLowerCase() ?? "";
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
      "Cache-Control": "private, max-age=300",
    },
  });
}
