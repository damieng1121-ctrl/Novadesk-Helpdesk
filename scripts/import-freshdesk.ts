/**
 * One-off Freshdesk -> Novadesk import for Companies, Agents, and Solutions
 * (KB) articles. Deliberately does NOT touch Contacts or Tickets — contacts
 * are being imported separately via CSV, and tickets need real contact rows
 * to link to as requesters, so they're a follow-up once that's done.
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
 *
 * Uses whatever DATABASE_URL is in the environment (e.g. from .env, or set
 * it inline) — point it at the target database deliberately.
 */
import { prisma } from "../src/lib/db";

const DOMAIN = process.env.FRESHDESK_DOMAIN;
const API_KEY = process.env.FRESHDESK_API_KEY;
const WRITE = process.argv.includes("--write");

if (!DOMAIN || !API_KEY) {
  console.error("Set FRESHDESK_DOMAIN and FRESHDESK_API_KEY environment variables first.");
  process.exit(1);
}

const BASE = `https://${DOMAIN}.freshdesk.com/api/v2`;
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

async function main() {
  console.log(`Mode: ${WRITE ? "WRITE (will modify the database)" : "DRY RUN (no database changes will be made)"}`);
  const tenant = await prisma.tenant.findFirstOrThrow();

  // --- Companies ---------------------------------------------------------
  console.log("\nFetching Freshdesk companies...");
  const fdCompanies = await fdGetAllPages("/companies");
  console.log(`Found ${fdCompanies.length} companies.`);
  let companiesWritten = 0;
  for (const c of fdCompanies) {
    const name = (String(c.name ?? `Company ${c.id}`)).trim().slice(0, 150);
    const domains = c.domains as string[] | undefined;
    const domain = domains && domains.length > 0 ? domains[0] : null;
    console.log(`  - ${name}${domain ? ` (${domain})` : ""}`);
    if (WRITE) {
      await prisma.company.upsert({
        where: { tenantId_name: { tenantId: tenant.id, name } },
        create: { tenantId: tenant.id, name, domain },
        update: { domain },
      });
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

  console.log("\nDone.");
  if (!WRITE) {
    console.log("This was a dry run — nothing was written. Re-run with --write to actually import.");
  } else {
    console.log(
      `Imported: ${companiesWritten} companies, ${agentIdToUserId.size} agents, ${articlesWritten} KB articles (all as drafts).`,
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
