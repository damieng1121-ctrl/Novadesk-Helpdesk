/**
 * One-off Freshdesk -> Novadesk import for Companies, Agents, and Solutions
 * (KB) articles. By default does NOT touch Contacts or Tickets — contacts
 * are being imported separately via CSV.
 *
 * Pass --with-tickets to additionally import Requesters + Tickets, but only
 * for tickets currently Open or Pending in Freshdesk — NOT a full contacts
 * dump. Only the requester of a qualifying ticket gets a User row; everyone
 * else in Freshdesk's contact list is left alone (still coming via the
 * separate CSV import). Imported requesters are created with
 * portalAccessGranted: false, and — critically — this script never calls
 * the app's invite API or any notification code path, only raw Prisma
 * writes, so nobody is emailed about these accounts being created.
 * Each qualifying ticket also pulls in its full conversation (replies +
 * private notes) as ticket comments. Attachments are NOT imported (on
 * either tickets or KB articles) — a deliberate scope cut, flag it to
 * Damien if that turns out to matter.
 *
 * Re-run safety for tickets: since Freshdesk ticket IDs aren't stored
 * anywhere in the schema, a ticket is considered "already imported" if a
 * ticket already exists for the same requester with the same subject and
 * the same createdAt timestamp (preserved from Freshdesk) — re-running the
 * script skips those rather than duplicating them. Comments are only
 * attached to a ticket the first time it's created, never re-added to an
 * already-imported ticket on a later run.
 *
 * Strictly read-only against Freshdesk: fdGet/fdGetAllPages below are the
 * only functions that talk to Freshdesk, and neither ever issues anything
 * but a GET request — there is no write path to Freshdesk in this script.
 *
 * Defaults to a dry run (fetches from Freshdesk and prints what it would
 * do, writes nothing to the database). Pass --write to actually import.
 *
 * Usage:
 *   FRESHDESK_DOMAIN=education-lincs FRESHDESK_API_KEY=xxx npx tsx scripts/import-freshdesk.ts
 *   FRESHDESK_DOMAIN=education-lincs FRESHDESK_API_KEY=xxx npx tsx scripts/import-freshdesk.ts --write
 *   FRESHDESK_DOMAIN=education-lincs FRESHDESK_API_KEY=xxx npx tsx scripts/import-freshdesk.ts --with-tickets --write
 *
 * Uses whatever DATABASE_URL is in the environment (e.g. from .env, or set
 * it inline) — point it at the target database deliberately.
 */
import { prisma } from "../src/lib/db";
import type { TicketPriority, TicketStatus, TicketType } from "@prisma/client";

const DOMAIN = process.env.FRESHDESK_DOMAIN;
const API_KEY = process.env.FRESHDESK_API_KEY;
const WRITE = process.argv.includes("--write");
const WITH_TICKETS = process.argv.includes("--with-tickets");

if (!DOMAIN || !API_KEY) {
  console.error("Set FRESHDESK_DOMAIN and FRESHDESK_API_KEY environment variables first.");
  process.exit(1);
}

// FRESHDESK_BASE_URL is an escape hatch for local testing against a mock
// server, or for an EU-hosted Freshdesk account with a non-default API
// host — normal usage never needs to set it.
const BASE = process.env.FRESHDESK_BASE_URL ?? `https://${DOMAIN}.freshdesk.com/api/v2`;
const authHeader = "Basic " + Buffer.from(`${API_KEY}:X`).toString("base64");

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** The only function that ever talks to Freshdesk — GET only, on purpose. */
async function fdGet(path: string): Promise<unknown> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(`${BASE}${path}`, { method: "GET", headers: { Authorization: authHeader } });
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("retry-after") ?? "5");
      console.log(`  (rate limited by Freshdesk, waiting ${retryAfter}s...)`);
      await sleep(retryAfter * 1000);
      continue;
    }
    if (!res.ok) {
      throw new Error(`Freshdesk GET ${path} -> HTTP ${res.status}: ${await res.text()}`);
    }
    return res.json();
  }
  throw new Error(`Freshdesk GET ${path} failed after retries (repeated 429s)`);
}

async function fdGetAllPages(path: string, perPage = 100): Promise<Record<string, unknown>[]> {
  const all: Record<string, unknown>[] = [];
  for (let page = 1; ; page++) {
    const sep = path.includes("?") ? "&" : "?";
    const batch = (await fdGet(`${path}${sep}page=${page}&per_page=${perPage}`)) as Record<string, unknown>[];
    if (!Array.isArray(batch) || batch.length === 0) break;
    all.push(...batch);
    if (batch.length < perPage) break;
  }
  return all;
}

function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
  return slug || "item";
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Freshdesk ticket status codes: 2 Open, 3 Pending, 4 Resolved, 5 Closed
// (6+ are tenant-defined custom statuses). Only 2 and 3 are ever fetched by
// this script (see FD_OPEN_STATUSES below), the rest are mapped defensively.
const FD_OPEN_STATUSES = [2, 3];
function mapFreshdeskStatus(fdStatus: number): TicketStatus {
  switch (fdStatus) {
    case 2:
      return "OPEN";
    case 3:
      return "ON_HOLD"; // Novadesk's "Pending" equivalent
    case 4:
      return "RESOLVED";
    case 5:
      return "CLOSED";
    default:
      return "OPEN";
  }
}

// Freshdesk priority codes: 1 Low, 2 Medium, 3 High, 4 Urgent.
function mapFreshdeskPriority(fdPriority: number): TicketPriority {
  switch (fdPriority) {
    case 1:
      return "LOW";
    case 3:
      return "HIGH";
    case 4:
      return "CRITICAL";
    default:
      return "MEDIUM";
  }
}

// Freshdesk's "type" field is a free-text tenant-configurable dropdown, so
// this is best-effort keyword matching, not an exhaustive mapping.
function mapFreshdeskType(fdType: string | undefined): TicketType {
  const t = (fdType ?? "").toLowerCase();
  if (t.includes("problem")) return "PROBLEM";
  if (t.includes("question")) return "INFORMATION";
  if (t.includes("quote")) return "QUOTE";
  if (t.includes("training")) return "TRAINING";
  if (t.includes("request")) return "REQUEST";
  return "INCIDENT";
}

async function main() {
  console.log(`Mode: ${WRITE ? "WRITE (will modify the database)" : "DRY RUN (no database changes will be made)"}`);
  const tenant = await prisma.tenant.findFirstOrThrow();

  // --- Companies ---------------------------------------------------------
  console.log("\nFetching Freshdesk companies...");
  const fdCompanies = await fdGetAllPages("/companies");
  console.log(`Found ${fdCompanies.length} companies.`);
  let companiesWritten = 0;
  const companyIdMap = new Map<number, string>(); // Freshdesk company id -> local Company id (only populated when WRITE)
  for (const c of fdCompanies) {
    const name = (String(c.name ?? `Company ${c.id}`)).trim().slice(0, 150);
    const domains = c.domains as string[] | undefined;
    const domain = domains && domains.length > 0 ? domains[0] : null;
    console.log(`  - ${name}${domain ? ` (${domain})` : ""}`);
    if (WRITE) {
      const company = await prisma.company.upsert({
        where: { tenantId_name: { tenantId: tenant.id, name } },
        create: { tenantId: tenant.id, name, domain },
        update: { domain },
      });
      companyIdMap.set(c.id as number, company.id);
      companiesWritten++;
    }
  }

  // --- Agents --------------------------------------------------------------
  console.log("\nFetching Freshdesk agents...");
  const fdAgents = await fdGetAllPages("/agents");
  console.log(`Found ${fdAgents.length} agents.`);
  const agentIdToUserId = new Map<number, string>();
  for (const a of fdAgents) {
    const contact = a.contact as { email?: string; name?: string } | undefined;
    const email = contact?.email?.trim().toLowerCase();
    const name = contact?.name?.trim() || email;
    if (!email) {
      console.log(`  - skipping agent id ${a.id} (no email on file)`);
      continue;
    }
    console.log(`  - ${name} <${email}>`);
    if (WRITE) {
      // Imported with portalAccessGranted: false — they get a User row for
      // linking purposes (e.g. as a KB article author) but not a login;
      // an admin invites them properly via Users & Companies when ready.
      const user = await prisma.user.upsert({
        where: { email },
        create: { email, name, role: "AGENT", tenantId: tenant.id, portalAccessGranted: false },
        // Never downgrade an already-invited real user's role/access on re-run.
        update: {},
      });
      agentIdToUserId.set(a.id as number, user.id);
    }
  }

  const fallbackAuthor = await prisma.user.findFirst({
    where: { tenantId: tenant.id, role: { in: ["TENANT_ADMIN", "SUPER_ADMIN"] } },
  });

  // --- Solutions (Knowledge Base) -----------------------------------------
  console.log("\nFetching Freshdesk solutions categories...");
  const categories = await fdGetAllPages("/solutions/categories");
  let articlesWritten = 0;
  for (const cat of categories) {
    const catName = String(cat.name ?? `Category ${cat.id}`).trim();
    const catSlug = slugify(catName);
    console.log(`\nCategory: ${catName}`);

    let kbCategoryId: string | undefined;
    if (WRITE) {
      const kbCategory = await prisma.kbCategory.upsert({
        where: { tenantId_slug: { tenantId: tenant.id, slug: catSlug } },
        create: { tenantId: tenant.id, name: catName, slug: catSlug },
        update: { name: catName },
      });
      kbCategoryId = kbCategory.id;
    }

    const folders = await fdGetAllPages(`/solutions/categories/${cat.id}/folders`);
    for (const folder of folders) {
      const articles = await fdGetAllPages(`/solutions/folders/${folder.id}/articles`);
      for (const art of articles) {
        const title = String(art.title ?? `Article ${art.id}`).trim();
        const slug = slugify(title);
        const content = String(art.description_text ?? "").trim() || "(imported article had no plain-text body)";
        const agentId = art.agent_id as number | undefined;
        const authorUserId = (agentId && agentIdToUserId.get(agentId)) || fallbackAuthor?.id;

        console.log(`  - ${title}`);
        if (WRITE) {
          if (!authorUserId) {
            console.log("    (skipped — no author could be resolved and there's no fallback admin)");
            continue;
          }
          // Imported as DRAFT deliberately — review before publishing, don't
          // put unreviewed imported content in front of Users automatically.
          await prisma.kbArticle.upsert({
            where: { tenantId_slug: { tenantId: tenant.id, slug } },
            create: {
              tenantId: tenant.id,
              categoryId: kbCategoryId,
              title,
              slug,
              content,
              status: "DRAFT",
              authorId: authorUserId,
            },
            update: { title, content, categoryId: kbCategoryId },
          });
          articlesWritten++;
        }
      }
    }
  }

  // --- Tickets (and their requesters) -------------------------------------
  // Opt-in via --with-tickets. Only Open/Pending tickets are imported, and
  // only the requester of a qualifying ticket gets a User row — this is
  // NOT a full contacts import. See the file-level docstring for the
  // re-run-safety and no-emails guarantees.
  let ticketsWritten = 0;
  let requestersWritten = 0;
  let commentsWritten = 0;
  if (WITH_TICKETS) {
    console.log(
      "\nScanning Freshdesk tickets for Open/Pending ones (walks the full ticket list — may take a while for a long history)...",
    );
    const allTickets = await fdGetAllPages("/tickets?order_by=created_at&order_type=asc");
    console.log(`Scanned ${allTickets.length} tickets total.`);
    const openTickets = allTickets.filter((t) =>
      FD_OPEN_STATUSES.includes((t as { status?: number }).status ?? -1),
    );
    console.log(`${openTickets.length} are currently Open or Pending — importing those (and their requesters).`);

    let nextNumber =
      (await prisma.ticket.aggregate({ where: { tenantId: tenant.id }, _max: { number: true } }))._max.number ?? 0;

    for (const summary of openTickets) {
      const fdId = summary.id as number;
      const detail = (await fdGet(`/tickets/${fdId}?include=requester`)) as Record<string, unknown>;
      const requesterInfo = detail.requester as { email?: string; name?: string } | undefined;
      const email = requesterInfo?.email?.trim().toLowerCase();
      const subject = String(detail.subject ?? `Ticket ${fdId}`).trim().slice(0, 300);
      console.log(`\n  Ticket #${fdId}: ${subject}`);

      if (!email) {
        console.log("    (skipped — requester has no email on file)");
        continue;
      }
      if (!WRITE) {
        console.log(`    would import — requester: ${requesterInfo?.name ?? email} <${email}>`);
        continue;
      }

      const createdAt = new Date(String(detail.created_at));

      // Re-run safety: skip a ticket already imported by an earlier run of
      // this script (see docstring — matched on requester+subject+createdAt
      // since Freshdesk ticket IDs aren't stored anywhere in the schema).
      const existing = await prisma.ticket.findFirst({
        where: { tenantId: tenant.id, subject, createdAt, requester: { email } },
        select: { id: true },
      });
      if (existing) {
        console.log("    (already imported — skipping)");
        continue;
      }

      const fdCompanyId = detail.company_id as number | undefined | null;
      const companyId = fdCompanyId ? companyIdMap.get(fdCompanyId) : undefined;

      // Imported with portalAccessGranted: false. Critically, this is a raw
      // Prisma write, never the /api/admin/users invite route — so nobody
      // gets an "account created" email for this.
      const requester = await prisma.user.upsert({
        where: { email },
        create: {
          email,
          name: requesterInfo?.name?.trim() || undefined,
          role: "REQUESTER",
          tenantId: tenant.id,
          companyId,
          portalAccessGranted: false,
        },
        // Never downgrade an already-invited real user's role/access on re-run.
        update: {},
      });
      requestersWritten++;

      const description =
        String(detail.description_text ?? "").trim() ||
        stripHtml(String(detail.description ?? "")) ||
        "(imported ticket had no plain-text body)";
      const responderId = detail.responder_id as number | undefined | null;
      const assigneeId = responderId ? agentIdToUserId.get(responderId) : undefined;
      const dueAt = detail.due_by ? new Date(String(detail.due_by)) : null;
      // Suppress an immediate flood of SLA-breach emails for tickets that
      // were already overdue in Freshdesk by the time they're imported.
      const slaBreachAlertedAt = dueAt && dueAt.getTime() < Date.now() ? new Date() : null;

      let ticket = null;
      for (let attempt = 0; attempt < 3 && !ticket; attempt++) {
        const number = nextNumber + 1;
        try {
          ticket = await prisma.ticket.create({
            data: {
              tenantId: tenant.id,
              number,
              subject,
              description,
              status: mapFreshdeskStatus(detail.status as number),
              priority: mapFreshdeskPriority(detail.priority as number),
              type: mapFreshdeskType(detail.type as string | undefined),
              companyId,
              requesterId: requester.id,
              assigneeId,
              dueAt,
              slaBreachAlertedAt,
              createdAt,
            },
          });
          nextNumber = number;
        } catch (err) {
          if ((err as { code?: string }).code === "P2002") {
            nextNumber =
              (await prisma.ticket.aggregate({ where: { tenantId: tenant.id }, _max: { number: true } }))._max
                .number ?? nextNumber;
            continue;
          }
          throw err;
        }
      }
      if (!ticket) {
        console.log("    (skipped — could not allocate a ticket number after retries)");
        continue;
      }
      ticketsWritten++;
      console.log(`    imported as #${ticket.number} (requester ${requesterInfo?.name ?? email})`);

      // Full conversation — only on first import of this ticket, never
      // re-added on a later run (the ticket-level dedup check above already
      // skipped this ticket entirely if it was previously imported).
      const conversations = await fdGetAllPages(`/tickets/${fdId}/conversations`);
      const sorted = [...conversations].sort(
        (a, b) =>
          new Date(String((a as { created_at?: string }).created_at)).getTime() -
          new Date(String((b as { created_at?: string }).created_at)).getTime(),
      );
      for (const conv of sorted) {
        const convUserId = conv.user_id as number | undefined;
        const incoming = Boolean(conv.incoming);
        const authorId =
          (convUserId && agentIdToUserId.get(convUserId)) || (incoming ? requester.id : fallbackAuthor?.id) || requester.id;
        const body =
          String(conv.body_text ?? "").trim() || stripHtml(String(conv.body ?? "")) || "(no content)";
        await prisma.ticketComment.create({
          data: {
            ticketId: ticket.id,
            authorId,
            body,
            isInternal: Boolean(conv.private),
            createdAt: new Date(String(conv.created_at)),
          },
        });
        commentsWritten++;
      }
    }
  }

  console.log("\nDone.");
  if (!WRITE) {
    console.log("This was a dry run — nothing was written. Re-run with --write to actually import.");
  } else {
    console.log(
      `Imported: ${companiesWritten} companies, ${agentIdToUserId.size} agents, ${articlesWritten} KB articles (all as drafts)` +
        (WITH_TICKETS
          ? `, ${ticketsWritten} tickets, ${requestersWritten} requesters, ${commentsWritten} comments.`
          : "."),
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
