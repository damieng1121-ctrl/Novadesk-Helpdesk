import { prisma } from "@/lib/db";

const TYPE_STYLES: Record<string, string> = {
  INFO: "border-blue-200 bg-blue-50 text-blue-800",
  WARNING: "border-amber-200 bg-amber-50 text-amber-800",
  ALERT: "border-red-200 bg-red-50 text-red-800",
};

export async function AnnouncementsBanner({
  tenantId,
  audience,
}: {
  tenantId: string;
  audience: "REQUESTERS" | "STAFF";
}) {
  const announcements = await prisma.announcement.findMany({
    where: { tenantId, active: true, targetAudience: { in: ["ALL", audience] } },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  if (announcements.length === 0) return null;

  return (
    <div className="space-y-2">
      {announcements.map((a) => (
        <div key={a.id} className={`rounded-md border px-4 py-3 text-sm ${TYPE_STYLES[a.type]}`}>
          <p className="font-medium">{a.title}</p>
          <p className="mt-0.5">{a.message}</p>
        </div>
      ))}
    </div>
  );
}
