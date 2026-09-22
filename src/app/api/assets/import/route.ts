import ExcelJS from "exceljs";
import { Readable } from "stream";
import { requireTenantSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { canManageTickets } from "@/lib/roles";
import type { AssetStatus } from "@prisma/client";

/**
 * Bulk asset import from a .xlsx or .csv spreadsheet. Column headers are
 * matched case-insensitively against a fixed set of recognised names (see
 * FIELD_SYNONYMS) — no user-facing column-mapping step, by design: keep
 * this simple, and let per-row warnings in the response guide someone to
 * fix their sheet's headers rather than build a mapping UI up front.
 *
 * Re-run safe: upserts on the existing (tenantId, tag) unique constraint,
 * so re-uploading an updated sheet refreshes existing assets by tag rather
 * than duplicating them.
 */

const ASSET_STATUSES: AssetStatus[] = ["ACTIVE", "IN_REPAIR", "RETIRED", "LOST"];

const FIELD_SYNONYMS: Record<string, string[]> = {
  tag: ["tag", "assettag", "assetid", "id"],
  name: ["name", "assetname", "description"],
  model: ["model"],
  serialNumber: ["serialnumber", "serial", "serialno", "sn"],
  company: ["company", "school", "site", "organisation", "organization"],
  assignedToEmail: ["assignedto", "assignedtoemail", "user", "owner", "email"],
  status: ["status"],
  purchaseDate: ["purchasedate", "datepurchased", "purchased"],
  warrantyExpiry: ["warrantyexpiry", "warranty", "warrantyenddate", "warrantyexpirydate", "warrantyend"],
};

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function matchField(header: string): string | null {
  const normalized = normalizeHeader(header);
  for (const [field, synonyms] of Object.entries(FIELD_SYNONYMS)) {
    if (synonyms.includes(normalized)) return field;
  }
  return null;
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const obj = value as { text?: unknown; richText?: { text: string }[] };
    if (typeof obj.text === "string") return obj.text;
    if (Array.isArray(obj.richText)) return obj.richText.map((t) => t.text).join("");
  }
  return String(value).trim();
}

function cellDate(value: unknown): Date | null {
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  const text = cellText(value);
  if (!text) return null;
  const d = new Date(text);
  return isNaN(d.getTime()) ? null : d;
}

function normalizeStatus(raw: string): AssetStatus | null {
  const normalized = raw.trim().toUpperCase().replace(/[\s-]+/g, "_");
  return (ASSET_STATUSES as string[]).includes(normalized) ? (normalized as AssetStatus) : null;
}

const MAX_DETAILED_ROWS = 500;

export async function POST(req: Request) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!canManageTickets(session.user.role)) throw new AuthError("Staff only", 403);

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new AuthError("No file provided", 400);

    const buffer = Buffer.from(await file.arrayBuffer());
    const isCsv = /\.csv$/i.test(file.name) || file.type === "text/csv";

    const workbook = new ExcelJS.Workbook();
    let worksheet;
    try {
      if (isCsv) {
        worksheet = await workbook.csv.read(Readable.from(buffer));
      } else {
        // exceljs's bundled types predate Node's current Buffer<ArrayBufferLike> generic.
        await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
        worksheet = workbook.worksheets[0];
      }
    } catch {
      throw new AuthError("Couldn't read that file — is it a valid .xlsx or .csv?", 400);
    }
    if (!worksheet) throw new AuthError("The file has no sheets", 400);

    const headerRow = worksheet.getRow(1);
    const columnForField = new Map<string, number>();
    headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const field = matchField(cellText(cell.value));
      if (field) columnForField.set(field, colNumber);
    });
    if (!columnForField.has("tag") || !columnForField.has("name")) {
      throw new AuthError(
        "Couldn't find both a \"Tag\" and a \"Name\" column in the header row — check your spreadsheet's headers.",
        400,
      );
    }

    const [tenantCompanies, tenantUsers] = await Promise.all([
      prisma.company.findMany({ where: { tenantId: session.user.tenantId }, select: { id: true, name: true } }),
      prisma.user.findMany({ where: { tenantId: session.user.tenantId }, select: { id: true, email: true } }),
    ]);
    const companyByName = new Map(tenantCompanies.map((c) => [c.name.trim().toLowerCase(), c.id]));
    const userByEmail = new Map(tenantUsers.map((u) => [u.email.trim().toLowerCase(), u.id]));

    function cell(row: ExcelJS.Row, field: string): unknown {
      const col = columnForField.get(field);
      return col ? row.getCell(col).value : undefined;
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const rows: { row: number; tag: string | null; action: "created" | "updated" | "skipped"; warnings: string[] }[] = [];

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      if (row.cellCount === 0) continue;

      const tag = cellText(cell(row, "tag"));
      const name = cellText(cell(row, "name"));
      if (!tag && !name) continue; // fully blank row

      const warnings: string[] = [];
      if (!tag || !name) {
        skipped++;
        rows.push({ row: rowNumber, tag: tag || null, action: "skipped", warnings: ["missing required Tag or Name"] });
        continue;
      }

      const model = cellText(cell(row, "model")) || undefined;
      const serialNumber = cellText(cell(row, "serialNumber")) || undefined;

      const companyRaw = cellText(cell(row, "company"));
      let companyId: string | undefined;
      if (companyRaw) {
        const match = companyByName.get(companyRaw.toLowerCase());
        if (match) companyId = match;
        else warnings.push(`company "${companyRaw}" not found — left unset`);
      }

      const emailRaw = cellText(cell(row, "assignedToEmail"));
      let assignedToId: string | undefined;
      if (emailRaw) {
        const match = userByEmail.get(emailRaw.toLowerCase());
        if (match) assignedToId = match;
        else warnings.push(`assigned-to user "${emailRaw}" not found — left unassigned`);
      }

      const statusRaw = cellText(cell(row, "status"));
      let status: AssetStatus = "ACTIVE";
      if (statusRaw) {
        const match = normalizeStatus(statusRaw);
        if (match) status = match;
        else warnings.push(`status "${statusRaw}" not recognised — defaulted to Active`);
      }

      const purchaseDate = cellDate(cell(row, "purchaseDate"));
      if (cellText(cell(row, "purchaseDate")) && !purchaseDate) warnings.push("purchase date couldn't be parsed — left unset");
      const warrantyExpiry = cellDate(cell(row, "warrantyExpiry"));
      if (cellText(cell(row, "warrantyExpiry")) && !warrantyExpiry) warnings.push("warranty expiry couldn't be parsed — left unset");

      const existing = await prisma.asset.findUnique({
        where: { tenantId_tag: { tenantId: session.user.tenantId, tag } },
        select: { id: true },
      });

      await prisma.asset.upsert({
        where: { tenantId_tag: { tenantId: session.user.tenantId, tag } },
        create: {
          tenantId: session.user.tenantId,
          tag,
          name,
          model,
          serialNumber,
          companyId,
          assignedToId,
          status,
          purchaseDate,
          warrantyExpiry,
        },
        update: {
          name,
          model,
          serialNumber,
          companyId,
          assignedToId,
          status,
          purchaseDate,
          warrantyExpiry,
        },
      });

      if (existing) updated++;
      else created++;
      if (rows.length < MAX_DETAILED_ROWS) {
        rows.push({ row: rowNumber, tag, action: existing ? "updated" : "created", warnings });
      }
    }

    return { created, updated, skipped, rows, truncated: rows.length >= MAX_DETAILED_ROWS };
  });
}
