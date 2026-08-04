# Novadesk Helpdesk

A multi-tenant IT helpdesk platform for UK primary schools: ticketing, a knowledge base,
Google SSO with 2FA, pluggable AI assistance (Claude or Gemini), and a DfE digital &
technology standards compliance checklist.

This is a working MVP scaffold — the full data model, auth, ticketing, knowledge base,
compliance tracker, and admin settings are implemented end to end, but production
hardening (real GCP credentials, file storage for attachments, email notifications,
production deployment) is left as documented next steps below.

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind CSS)
- **PostgreSQL** via **Prisma 6**
- **Auth.js (NextAuth v5)** with the Google provider, restricted per-tenant by Google
  Workspace domain — designed to sit behind **Google Identity Platform** in production
- **TOTP-based 2FA** (`otplib`), enforced as a second factor after Google SSO
- **Pluggable AI layer** (`src/lib/ai`) supporting **Claude (Anthropic)** or **Gemini
  (Google Vertex AI)**, selectable per school

## Getting started

```bash
npm install
cp .env.example .env        # then fill in real values, see below
docker run --name novadesk-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=novadesk -p 5432:5432 -d postgres:16
npm run db:migrate          # creates tables
npm run db:seed             # seeds DfE compliance catalogue + a demo school
npm run dev
```

Visit `http://localhost:3000`.

### Required environment variables

See `.env.example` for the full list and generation commands. At minimum, for local dev:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `AUTH_SECRET` | Session encryption — `openssl rand -base64 32` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth credentials from Google Cloud Console |
| `APP_ENCRYPTION_KEY` | Encrypts 2FA secrets and tenant-supplied AI API keys at rest — `openssl rand -hex 32` |
| `ANTHROPIC_API_KEY` / `GOOGLE_GENAI_API_KEY` | Platform-level fallback AI keys (optional — schools can also supply their own in Settings) |

Without real Google OAuth credentials you can still browse the DB (`npm run db:studio`),
run `next build`, and inspect the seeded demo data, but you won't be able to complete a
sign-in — Google SSO is the only auth path by design (see below).

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
  to any school domain.
- 2FA (TOTP) is opt-in per user today, from **Account → Security**. To make it
  mandatory for staff roles, gate `src/middleware.ts`'s `authorized()` callback on
  `role !== "REQUESTER"` in addition to `twoFactorEnabled`.

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
src/lib/auth.config.ts     Edge-safe auth config used by middleware
src/lib/session.ts         Server-side session/tenant/role guards for API routes
src/lib/tenancy.ts         Tenant resolution helpers
src/lib/twofactor.ts       TOTP generation/verification
src/lib/crypto.ts          AES-256-GCM encryption for secrets at rest
src/lib/ai/                Pluggable AI provider abstraction (Claude / Gemini)
src/app/api/                REST-ish API routes, all tenant/role-scoped server-side
src/app/portal/             The authenticated app (tickets, KB, compliance, admin)
```

## Deployment (Google Cloud)

This scaffold is designed to deploy on:

- **Cloud Run** for the Next.js app (containerize with a standard `next start` Dockerfile)
- **Cloud SQL for PostgreSQL** as the database (`DATABASE_URL` via Cloud SQL Auth Proxy
  or a private IP connection)
- **Secret Manager** for `AUTH_SECRET`, `APP_ENCRYPTION_KEY`, OAuth client secret, and
  AI API keys, mounted as env vars into Cloud Run
- **Google Identity Platform** for SSO, as described above
- A wildcard DNS record / Cloud Run domain mapping if you want true per-school
  subdomains (`{slug}.yourdomain.com`) — `src/lib/tenancy.ts` already resolves the
  subdomain, but tenancy is enforced by session, not subdomain, so this is optional.

None of this is wired into the repo yet (no `Dockerfile`/`cloudbuild.yaml`) — that's the
main remaining piece of "production-ready," along with file storage for ticket
attachments (currently modelled in the schema but with no upload endpoint) and outbound
email notifications.

## What's not built yet

- File upload storage backend for ticket attachments (schema/model exists; no upload UI/route)
- Email notifications (new ticket, reply, SLA breach)
- A platform-admin UI for onboarding new schools (currently done via seed script / direct DB)
- SLA policies and reporting/analytics dashboards
- Dockerfile / CI / cloudbuild.yaml for Cloud Run deployment
- Enforcing 2FA as mandatory for staff roles (currently opt-in per user)
