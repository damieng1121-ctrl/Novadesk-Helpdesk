# Novadesk Helpdesk

A multi-tenant IT helpdesk platform for UK primary schools: ticketing, a knowledge base,
Google SSO with 2FA, pluggable AI assistance (Claude or Gemini), and a DfE digital &
technology standards compliance checklist.

This is a working MVP — the full data model, auth, ticketing (with SLAs, attachments,
and email notifications), knowledge base, compliance tracker, reporting, and admin
settings are implemented end to end, runnable locally today via a one-click dev login
with no external credentials needed. Real Google OAuth credentials, a production
deployment, and a few smaller gaps are documented as next steps below.

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind CSS)
- **PostgreSQL** via **Prisma 6**
- **Auth.js (NextAuth v5)** with the Google provider, restricted per-tenant by Google
  Workspace domain — designed to sit behind **Google Identity Platform** in production
- **TOTP-based 2FA** (`otplib`), enforced as a second factor after Google SSO
- **Pluggable AI layer** (`src/lib/ai`) supporting **Claude (Anthropic)** or **Gemini
  (Google Vertex AI)**, selectable per school

## Getting started

### Option A: plain Node (fastest iteration)

```bash
npm install
cp .env.example .env        # then fill in real values, see below
docker run --name novadesk-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=novadesk -p 5432:5432 -d postgres:16
npm run db:migrate          # creates tables
npm run db:seed             # seeds DfE compliance catalogue + a demo school
npm run dev
```

Visit `http://localhost:3000`. **No Google OAuth credentials?** `npm run dev` shows a
"Dev login (local only)" section on the sign-in page — one click to sign in as any
seeded demo user, no Google account needed. It only exists in `next dev` (see below),
so there's no risk of it shipping to a real deployment.

### Option B: Docker Compose (closer to production)

```bash
cp .env.example .env        # fill in AUTH_SECRET, GOOGLE_CLIENT_ID/SECRET, APP_ENCRYPTION_KEY at minimum
docker compose up --build
```

This builds the app image (see `Dockerfile`), starts Postgres, applies migrations on
container start (`docker-entrypoint.sh`), and serves the app at `http://localhost:3000`.
Set `SEED_ON_START=true` in `.env` to also load the demo school on first boot. To seed
manually against the compose stack instead: `docker compose exec app npx prisma db seed`.

Either way, sign-in requires a real Google OAuth client — see below — with
`http://localhost:3000/api/auth/callback/google` as an authorized redirect URI, and at
least one `Tenant.domain` in the database matching the email domain you sign in with
(the seed script creates one: `willowbrook-primary.sch.uk`).

### Required environment variables

See `.env.example` for the full list and generation commands. At minimum, for local dev:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `AUTH_SECRET` | Session encryption — `openssl rand -base64 32` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth credentials from Google Cloud Console |
| `APP_ENCRYPTION_KEY` | Encrypts 2FA secrets and tenant-supplied AI API keys at rest — `openssl rand -hex 32` |
| `ANTHROPIC_API_KEY` / `GOOGLE_GENAI_API_KEY` | Platform-level fallback AI keys (optional — schools can also supply their own in Settings) |

Without real Google OAuth credentials, `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` can stay
blank for now — use the dev login described below to sign in and explore the UI, then
come back and fill those in when you're ready to test real SSO.

## Multi-tenancy model

Every school is a `Tenant` row. All tenant-owned data (`Ticket`, `KbArticle`,
`ComplianceAssessment`, etc.) carries a `tenantId` foreign key. **Isolation is enforced
in application code, not the database**: every API route resolves `tenantId` from the
authenticated session (`src/lib/session.ts`) — never from a client-supplied value — so a
crafted request can't read another school's data. See `src/lib/tenancy.ts` for the
rationale and the (cosmetic, non-security) subdomain-routing helper.

## Authentication & 2FA

- Sign-in is Google-only, matched against each `Tenant.domain` (a school's Google
  Workspace domain, e.g. `willowbrook-primary.sch.uk`). The first person from a
  registered domain to sign in is auto-provisioned as a `REQUESTER`; a `TENANT_ADMIN`
  promotes staff to `AGENT`/`TENANT_ADMIN` from **Users**.
- A platform-level `SUPER_ADMIN` allowlist is controlled by the
  `NOVADESK_SUPER_ADMIN_EMAILS` env var (comma-separated), for Novadesk staff, not tied
  to any school domain. A super admin gets a **Schools** page (`/portal/super-admin`) to
  onboard new schools (name, slug, Workspace domain, phase) and suspend existing ones —
  no more direct DB/seed-script access needed for this.
- 2FA (TOTP) is **mandatory for staff** (`AGENT`, `TENANT_ADMIN`, `SUPER_ADMIN`) and
  optional for `REQUESTER`s. A staff account without 2FA enabled is redirected to
  **Account → Security** on every route except that page itself until they enrol —
  enforced both in `src/lib/auth.config.ts` (page-level redirect) and again in
  `src/lib/session.ts`'s `requireSession()` (API-level, so a direct API call can't skip
  it). Staff can't turn 2FA back off once enabled (`/api/auth/2fa/disable` rejects it).
- **Dev login** (`src/lib/auth.ts`, the `dev-login` Credentials provider): sign in as any
  already-seeded user by email, no password or Google account required. It's only added
  to the providers array when `NODE_ENV !== "production"` — `next build` + `next start`
  (including the Docker image) always run with `NODE_ENV=production`, so this is
  structurally absent from anything resembling a real deployment, not just hidden from
  the UI. It never creates a user, only signs into an existing row. Staff accounts
  signed in this way still go through the real mandatory-2FA flow — that part isn't
  bypassed.

### Setting up Google Identity Platform / OAuth

1. In the Google Cloud Console, create (or reuse) a project and enable **Identity
   Platform** (or, more simply, just the standard **Google Identity / OAuth consent
   screen** — Identity Platform is Google's managed layer on top of the same OAuth flow,
   and adds SAML/OIDC federation for schools using a different IdP, and centralized
   MFA policy if you want to enforce 2FA at the IdP level instead of/alongside the
   in-app TOTP here).
2. Create an OAuth 2.0 Client ID (Web application). Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (dev)
   - `https://<your-domain>/api/auth/callback/google` (prod)
3. Put the client ID/secret in `.env` as `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
4. Register each school as a `Tenant` row with its Google Workspace `domain` — either
   via `prisma/seed.ts`-style scripts or a future platform-admin UI (not yet built).

## AI integration

`src/lib/ai/index.ts` resolves an `AiCompletionProvider` per tenant: Claude, Gemini, or
disabled (a safe no-op). Each tenant can configure its provider and optionally its own
API key from **Settings** (encrypted at rest with `APP_ENCRYPTION_KEY`); otherwise the
platform's own `ANTHROPIC_API_KEY`/`GOOGLE_GENAI_API_KEY` is used as a fallback. AI is
used for:

- **Ticket triage** — suggests a category, priority, and one-line summary when a ticket
  is raised (`src/app/api/tickets/route.ts`).
- **Knowledge base suggestions** — the provider interface (`suggestKbArticles`) is ready
  to wire into the ticket view to recommend matching articles; not yet surfaced in the UI.

All AI calls are wrapped (`SafeAiProvider`) so a provider outage never blocks ticket
creation — it just falls back to no suggestion.

## DfE digital & technology standards compliance

`prisma/seed.ts` seeds a global catalogue of standards/items (broadband, wireless,
network switches, servers, cyber security, filtering & monitoring, cloud solutions,
digital leadership, business continuity, digital accessibility) modelled on DfE's
published *"Meeting digital and technology standards in schools and colleges"*
guidance. Each school tracks its own status (Not started / In progress / Compliant /
Non-compliant / N/A), evidence notes, and next review date from **DfE compliance** in
the portal.

**Important**: this seed content reflects the shape of DfE's framework, not a verbatim
copy — DfE updates the standards periodically. Before using this for an official return,
check current wording/thresholds at
<https://www.gov.uk/guidance/meeting-digital-and-technology-standards-in-schools-and-colleges>
and update `prisma/seed.ts` (or edit rows directly) accordingly.

## Project structure

```
prisma/schema.prisma       Data model (multi-tenant)
prisma/seed.ts             DfE compliance catalogue + demo school data
src/lib/auth.ts            Auth.js config (Google provider, Prisma adapter, tenant resolution)
src/lib/auth.config.ts     Edge-safe auth config used by proxy
src/lib/session.ts         Server-side session/tenant/role guards for API routes
src/lib/tenancy.ts         Tenant resolution helpers
src/lib/twofactor.ts       TOTP generation/verification
src/lib/crypto.ts          AES-256-GCM encryption for secrets at rest
src/lib/ai/                Pluggable AI provider abstraction (Claude / Gemini)
src/app/api/                REST-ish API routes, all tenant/role-scoped server-side
src/app/portal/             The authenticated app (tickets, KB, compliance, admin)
```

## Deployment (Google Cloud)

The `Dockerfile` (`npm run build` + `npm start`, migrations applied on container start
by `docker-entrypoint.sh`) is written to run as-is on:

- **Cloud Run** for the app — `gcloud run deploy novadesk --source . --region europe-west2`
  (or build with Cloud Build and deploy the image) will work directly against this
  Dockerfile. Set `PORT` is already handled (Cloud Run injects it; the entrypoint honors
  `$PORT` via `next start`).
- **Cloud SQL for PostgreSQL** as the database (`DATABASE_URL` via the Cloud SQL Auth
  Proxy sidecar or a private IP connection)
- **Secret Manager** for `AUTH_SECRET`, `APP_ENCRYPTION_KEY`, the OAuth client secret,
  and AI API keys, mounted as env vars into Cloud Run
- **Google Identity Platform** for SSO, as described above
- A wildcard DNS record / Cloud Run domain mapping if you want true per-school
  subdomains (`{slug}.yourdomain.com`) — `src/lib/tenancy.ts` already resolves the
  subdomain, but tenancy is enforced by session, not subdomain, so this is optional.

Not yet wired in: an actual `cloudbuild.yaml`/CI pipeline that builds and deploys the
image automatically on push — today deploying is a manual `gcloud run deploy` (or
`docker compose up` locally, see above).

## SLA & reporting

`src/lib/sla.ts` defines flat resolution-time targets per priority (CRITICAL: 4h, HIGH:
8h, MEDIUM: 24h, LOW: 40h) and computes each ticket's `dueAt` on creation and whenever
its priority changes (re-baselined off the original creation time, not "now"). Overdue
open tickets are flagged in the ticket list/detail views. **Reports**
(`/portal/reports`, staff/admin only) shows ticket counts by status/priority, the
current overdue count, and average resolution time. These are flat platform-wide
targets rather than per-tenant configurable SLA policies — a reasonable next step if
schools need different targets.

## Ticket attachments

Files can be attached when raising a ticket or replying to one (`src/lib/storage.ts`).
Storage defaults to local disk (`UPLOAD_STORAGE_DIR`, gitignored) — fine for a single
dev/demo instance, but it won't survive a redeploy and won't work across multiple Cloud
Run instances, so swap it for a Cloud Storage-backed implementation before going to
production (the three-function interface — `saveUpload`/`readUpload`/`deleteUpload` — is
the only thing that needs to change; nothing else references the filesystem directly).
Downloads are served through an authenticated API route
(`/api/tickets/[id]/attachments/[attachmentId]`), never from `public/`, so tenant/ticket
access control and the internal-note visibility rule both still apply to attachments —
a requester can't download a file attached to an internal-only note even if they know
its URL.

## Email notifications

`src/lib/notifications/` is a small pluggable layer (same shape as the AI provider
abstraction) — SMTP if `SMTP_HOST` is set, console logging in dev otherwise, silently
disabled in production without SMTP configured. It's platform-wide, not per-tenant
(schools don't bring their own mail server). Wired into three events
(`src/lib/notifications/events.ts`): a new ticket emails the requester a confirmation
and the tenant's agents/admins a triage alert; a new non-internal reply emails whichever
side didn't just post (internal notes never trigger an email); marking a ticket resolved
emails the requester. All sends are best-effort — a broken SMTP relay logs an error but
never fails the ticket action that triggered it. SLA-breach alerts aren't included since
they need a recurring job (e.g. Cloud Scheduler hitting a route) rather than a
request-triggered event, and no scheduler is wired up yet.

## What's not built yet

- Per-tenant configurable SLA policies (currently one flat set of targets platform-wide)
- Scheduled SLA-breach notifications (would need a Cloud Scheduler job or similar; the reply/resolved/new-ticket emails above are all request-triggered, not time-triggered)
- Swapping local-disk attachment storage for Cloud Storage before a real deployment
- CI / `cloudbuild.yaml` for automatic Cloud Run deploys on push
