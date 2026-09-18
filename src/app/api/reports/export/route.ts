import { requireTenantSession, AuthError } from "@/lib/session";
import { prisma } from "@/lib/db";
import { canManageTickets } from "@/lib/roles";
import { buildReportRows } from "@/lib/reports";

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

const HEADERS = [
  "Number",
  "Subject",
  "Status",
  "Priority",
  "Category",
  "Company",
  "Requester",
  "Assignee",
  "Created",
  "Resolved",
  "Due",
];

export async function GET(req: Request) {
  let session;
  try {
    session = await requireTenantSession();
  } catch (err) {
    if (err instanceof AuthError) return Response.json({ error: err.message }, { status: err.status });
    throw err;
  }
  if (!canManageTickets(session.user.role)) {
    return Response.json({ error: "Only helpdesk staff can export reports" }, { status: 403 });
  }

  const days = Number(new URL(req.url).searchParams.get("days") ?? "0") || null;
  const rows = await buildReportRows(prisma, session.user.tenantId, days);

  const lines = [
    HEADERS.join(","),
    ...rows.map((r) =>
      [
        String(r.number),
        r.subject,
        r.status,
        r.priority,
        r.category?.name ?? "",
        r.requester.company?.name ?? "",
        r.requester.name ?? r.requester.email ?? "",
        r.assignee?.name ?? r.assignee?.email ?? "",
        r.createdAt.toISOString(),
        r.resolvedAt?.toISOString() ?? "",
        r.dueAt?.toISOString() ?? "",
      ]
        .map(csvCell)
        .join(","),
    ),
  ];

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tickets-report-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
