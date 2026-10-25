# MYCOFERT Burundi

Bilingual (French-first, English available) marketing website **and** self-hosted admin CMS for
MYCOFERT Burundi — a mushroom producer, processor, substrate/fertilizer supplier and mushroom-farming
trainer based in Bujumbura.

The public site presents the product lines, the about / sustainability / training / contact pages and
the news, and captures customer inquiries. The admin area at `/admin` lets a **non-technical owner**
edit products, news, page texts and contact details, and read incoming inquiries — no rebuild and no
redeploy. Uploaded images go straight from the browser to object storage; the app only stores the URL.

**Stack:** Next.js 16 (App Router, Turbopack) · React 19 · TypeScript 5 · Prisma 6 · PostgreSQL 16
(Supabase or Neon) · Tailwind CSS v4 · Radix UI · S3-compatible object storage (Supabase Storage,
Neon Object Storage, R2, B2, S3 — or Cloudinary) · optional Upstash Redis.

---

## Documentation map

| Document | Audience | What it covers |
|---|---|---|
| **This file** | Everyone | What the project is, how to run it, the script and environment references, the layout |
| [docs/manual.md](docs/manual.md) | **The site owner (non-technical)** | Click-by-click guide to the public pages and the admin dashboard |
| [docs/architecture.md](docs/architecture.md) | Developers | Request lifecycle, routing model, i18n, data model, auth design, resilience, security controls |
| [docs/api.md](docs/api.md) | Developers / integrators | Every HTTP endpoint: methods, auth, validation, rate limits, responses, headers |
| [docs/operations.md](docs/operations.md) | DevOps / on-call | Environments, migrations, deployment, health checks, secret rotation, incident playbooks |
| [docs/neon-setup-guide.md](docs/neon-setup-guide.md) | DevOps | Provisioning the Neon PostgreSQL database |
| [docs/supabase-setup-guide.md](docs/supabase-setup-guide.md) | DevOps | Alternative PostgreSQL provider (Supabase) |

---

## Feature summary

**Public website**

- Real, indexable URLs with a language prefix (`/fr`, `/en/products`, `/fr/news/{slug}`); a bare `/`
  renders French and is canonicalised to `/fr` in the address bar.
- Eight page types: home, products, about, sustainability, training, news listing, news article,
  contact. Unknown paths and unknown news slugs are true 404s.
- Dynamic `sitemap.xml`, `robots.txt`, per-page metadata with `hreflang` alternates for both languages.
- Contact form with spam protection (honeypot field plus IP rate limit) that lands in the admin inbox.
- First-party page-view analytics, surfaced in the admin dashboard. No third-party tracker.
- Floating WhatsApp button and `wa.me` deep links, with per-product prefilled messages.

**Admin CMS** (`/admin`, passcode-protected)

- Four tabs: **Inquiries**, **Products**, **News**, **Site content**.
- Full CRUD for products and news, each with bilingual fields, a publish/hide switch, drag-free
  ordering via `sortOrder`, and an image picker (local preset library or an upload to the configured
  storage provider).
- Site content editor for contact details, homepage, training, about and sustainability text — every
  field bilingual, each group saved independently.
- Inquiries inbox with statistics (new vs handled, by subject, top pages) and RFC 4180 CSV export.
- Passcode change plus a **single-use recovery code** so a forgotten passcode never means editing
  `.env` or hand-editing the database.
- A built-in **guided tour** covering both the public pages and the admin area.

**Platform**

- Stateless HMAC-signed admin sessions (12 h), constant-time verification, no passcode in the token.
- Redis-backed rate limiting that degrades to a single-instance in-memory store.
- Resilient to a sleeping/cold database: batched queries, retry on transient errors, and a documented
  fallback to built-in content.
- Nonce-based Content-Security-Policy and a strict static security-header set.
- Optional deep health probe (`?deep=1`) reporting database latency and content-degradation status.

---

## Quick start

### Prerequisites

- **Node.js 20+**
- A **PostgreSQL 16** database — either
  - a local Docker container (see below), **or**
  - a remote managed instance (Neon/Supabase); see [docs/neon-setup-guide.md](docs/neon-setup-guide.md)
- **Bun** — only needed if you use the `.zscripts/*.sh` helper scripts; not needed for `npm run dev`.

> **No Docker / no WSL2?** Use a remote database. It is the supported path for this project; the app
> talks to whatever `DATABASE_URL` points at.

### 1. Install

```bash
npm install
```

### 2. Start a local database (skip if using a remote one)

```bash
docker compose up -d
```

This starts `postgres:16-alpine` on port 5432 with user `mycofert`, password `mycofert_dev`,
database `mycofert`, persisting to the `mycofert_pgdata` volume. It is a **development-only**
credential set.

### 3. Configure the environment

```bash
cp .env.example .env
# then edit .env — see the environment section below
```

At minimum set `DATABASE_URL`, `DIRECT_URL`, `ADMIN_PASSCODE` (12+ characters) and
`ADMIN_SESSION_SECRET` (32+ characters).

### 4. Create the schema

```bash
npm run db:migrate   # applies prisma/migrations (development)
npm run db:seed      # optional: baseline CMS settings
```

In production use `npm run db:deploy` instead — it applies pending migrations without the
interactive prompts.

### 5. Run

```bash
npm run dev
```

- Website: <http://localhost:3000> (redirects to `/fr`)
- Admin: <http://localhost:3000/admin>

The dev server prints `[startup] ✅ Auth configuration OK.` when the auth secrets are usable. If you
see `⚠️ Auth configuration problems detected`, the admin dashboard will answer `503` until they are
fixed.

---

## npm scripts

| Script | Command | Purpose |
|---|---|---|
| `npm run dev` | `next dev -p 3000` | Development server with hot reload |
| `npm run build` | `next build && node scripts/prepare-standalone.mjs` | Production build; then copies `.next/static` and `public/` into the standalone output |
| `npm start` | `node .next/standalone/server.js` | Run the built standalone server |
| `npm run lint` | `eslint .` | ESLint (Next core-web-vitals + TypeScript) |
| `npm run typecheck` | `tsc --noEmit` | TypeScript type-check |
| `npm test` | `vitest run` | Unit tests (`src/__tests__`) |
| `npm run test:watch` | `vitest` | Unit tests in watch mode |
| `npm run images:manifest` | `node scripts/gen-image-manifest.mjs` | Regenerate `src/lib/image-manifest.json` |
| `npm run db:generate` | `prisma generate` | Regenerate the Prisma Client |
| `npm run db:migrate` | `prisma migrate dev` | Create and apply a migration (development) |
| `npm run db:deploy` | `prisma migrate deploy` | Apply pending migrations (production) |
| `npm run db:studio` | `prisma studio` | Browse the database in a GUI |
| `npm run db:seed` | `prisma db seed` | Insert baseline CMS settings |
| `npm run db:reset` | `prisma migrate reset` | **Destructive** — drop, re-migrate and re-seed |

`predev` and `prebuild` run `images:manifest` automatically, so the image manifest is always fresh
before a dev server or a build.

---

## Environment variables

Full annotated template: [.env.example](.env.example).

### Database

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | **Yes** | PostgreSQL connection string used at runtime. For a pooler (Neon `-pooler`, Supabase pooling, PgBouncer) it should carry `pgbouncer=true` and `connection_limit=1`. |
| `DIRECT_URL` | **Yes** for migrations | Unpooled connection used by Prisma Migrate. For Neon, remove `-pooler` from the host. |
| `DATABASE_CONNECTION_LIMIT` | No | Pool size **per instance**, appended to `DATABASE_URL` only when the URL does not already encode a `connection_limit`. Total connections = instances × this value. |

### Admin authentication

| Variable | Required | Notes |
|---|---|---|
| `ADMIN_PASSCODE` | **Yes** | The **initial** passcode, minimum 12 characters. Once changed in the dashboard (or reset with a recovery code) the database hash wins and this variable is ignored. |
| `ADMIN_SESSION_SECRET` | **Yes** | HMAC key signing admin tokens, minimum 32 characters. Must be **identical on every instance**. Rotating it invalidates all live sessions. |
| `ADMIN_ALLOW_INSECURE` | No | Dev-only escape hatch (`"1"`), ignored when `NODE_ENV=production`. |

### Networking, runtime, retention

| Variable | Required | Notes |
|---|---|---|
| `TRUST_PROXY` | No | Set to `"1"` **only** when a proxy you control overwrites `X-Forwarded-For`. Left unset, rate limiting is spoof-proof and uses a shared bucket for unknown clients. |
| `SITE_URL` | No | Canonical origin for metadata and the sitemap. Defaults to `https://mycofert.bi` with trailing slashes stripped. |
| `PAGEVIEW_RETENTION_DAYS` | No | Days of page-view history to keep. Default `365`; `0` disables pruning. |

### Optional integrations

| Variable | Required | Notes |
|---|---|---|
| `RATE_LIMIT_REDIS_URL` / `RATE_LIMIT_REDIS_TOKEN` | No | Upstash-compatible Redis REST endpoint for cross-instance rate limiting. Unset falls back to a per-instance in-memory store (with a production warning). |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | No | Accepted as aliases for the pair above. |

### Image uploads (optional)

Storage wins when configured; Cloudinary is the fallback; with neither, uploads are disabled and the
bundled local image library keeps working. All six storage values are needed **together** — a
half-filled block counts as "not configured", so a mistake surfaces as a clear message instead of a
provider error at upload time.

| Variable | Required | Notes |
|---|---|---|
| `STORAGE_ENDPOINT` | together | S3-compatible endpoint. Supabase Storage: `https://<ref>.supabase.co/storage/v1/s3`. Neon: `https://<bucket>.storage.<region>.aws.neon.tech`. |
| `STORAGE_REGION` | together | Provider region. Defaults to `auto` (the R2 convention) when unset. |
| `STORAGE_BUCKET` | together | Bucket the objects are written to. |
| `STORAGE_ACCESS_KEY_ID` / `STORAGE_SECRET_ACCESS_KEY` | together | **Server-only.** These bypass the bucket's public-key policies, so never prefix them with `NEXT_PUBLIC_`. |
| `NEXT_PUBLIC_STORAGE_PUBLIC_URL` | together | Public base URL objects are served from; also added to the CSP `img-src` and validated by `isAllowedImageUrl`. Because it is `NEXT_PUBLIC_`, it is inlined at **build** time — changing it needs a rebuild, not a restart. |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | No | Fallback upload target, used only while the storage block is unset. Leave all three empty rather than filling in placeholders — non-empty dummy values make the app think Cloudinary is configured and the first upload fails with a confusing 401 from Cloudinary itself. `CLOUDINARY_CLOUD_NAME` is the account cloud name, not an upload preset. |

> **Never commit a populated `.env`.** `.env.example` is tracked by git, so it must contain
> placeholders only. Put real values in the deployment secret store.

---

## Project layout

```
src/
  app/
    layout.tsx                  Root HTML, fonts, metadata, CSP nonce, toaster
    [[...slug]]/page.tsx        Catch-all route: parses the URL, loads content, renders the shell
    sitemap.ts                  Dynamic sitemap (pages + news, both languages)
    globals.css                 Tailwind v4 theme tokens
    api/                        Route handlers — see docs/api.md
  components/
    site/                       Public pages, admin panels, router, i18n wiring, guided tour
    ui/                         shadcn-style Radix primitives
  hooks/                        use-toast, use-mobile
  lib/
    auth.ts                     Token issue/verify, scrypt passcode hashing, recovery codes
    db.ts                       Prisma singleton and connection-limit handling
    db-retry.ts                 Transient-error detection and retry wrapper
    rate-limit.ts               Redis + in-memory stores, named limit policies
    route.ts                    Pure URL ⇄ Route mapping shared by server and client
    cms-server.ts               Server-side content loading with fallback
    cms-defaults.ts             Default content, image library, setting keys
    image-url.ts                Which image URLs may be stored and rendered (shared by client and server)
    uploads.ts                  Upload contract: accepted MIME types and the size ceiling
    object-storage.ts           S3-compatible presigned uploads (server-only)
    cloudinary.ts               Fallback signed-upload signature (used when object storage is unset)
    csv.ts                      RFC 4180 escaping with formula-injection guard
    site.ts                     Contact constants and WhatsApp link builder
    i18n/                       fr.ts (source of truth), en.ts (mirrored), index.ts
    image-manifest.json         Generated at build time — do not edit by hand
  proxy.ts                      Per-request CSP nonce (Next's middleware equivalent)
  instrumentation.ts            Startup auth-configuration check
  __tests__/                    Vitest unit tests
prisma/
  schema.prisma                 Data model
  migrations/                   SQL migration history
  seed.ts                       Baseline settings
scripts/
  gen-image-manifest.mjs        Scans public/images, writes image-manifest.json
  prepare-standalone.mjs        Assembles a runnable standalone output
public/images/                  The nine-slot preset image library
.zscripts/                      Build/dev/start helpers for the hosted sandbox
Caddyfile                       TLS-terminating reverse proxy for production
docker-compose.yml              Local development PostgreSQL
```

---

## Data model

Four tables, defined in [prisma/schema.prisma](prisma/schema.prisma):

| Model | Purpose | Notable fields |
|---|---|---|
| `Inquiry` | Contact-form submissions | `type`, `status` (`new`/`handled`), `lang`, indexed on `createdAt`, `status`, `type` |
| `PageView` | First-party analytics | `path`, `lang`, indexed on `path` and `createdAt` |
| `Product` | Product catalogue | unique `slug`, `published`, `sortOrder`, `imageKey` + optional `imageUrl`, all text bilingual (`nameFr`/`nameEn`, …) |
| `NewsPost` | News articles | unique `slug`, `published`, `imageKey` + optional `imageUrl`, bilingual title/excerpt/body/date |
| `SiteSetting` | Key/value store | `key` (`contact`, `home`, `training`, `about`, `sustainability`, plus `admin_passcode_hash` and `admin_recovery_hash`) |

Indexes are chosen for the real query patterns, not speculatively — see the comments in the schema.

Full detail: [docs/architecture.md](docs/architecture.md).

---

## Deployment

The build produces a self-contained artifact:

```bash
npm run build
```

`output: "standalone"` plus `scripts/prepare-standalone.mjs` yield a runnable
`.next/standalone/server.js` with `.next/static` and `public/` copied in. `.zscripts/build.sh` wraps
this into a `tar.gz` for the hosting sandbox, and `.zscripts/start.sh` validates the environment and
starts the server. `Caddyfile` terminates TLS and reverse-proxies to port 3000, overwriting
`X-Forwarded-For` so `TRUST_PROXY=1` is safe behind it.

Runtime requirements: a reachable `DATABASE_URL`, plus `ADMIN_PASSCODE` and `ADMIN_SESSION_SECRET` as
secrets. Redis, object storage and Cloudinary are optional.

Health probes:

| Probe | Meaning |
|---|---|
| `GET /api/health` | Cheap liveness — process is up |
| `GET /api/health?deep=1` | Readiness — checks the database, reports `database.latencyMs`, returns `503` when degraded, and includes content-fallback status |

Full runbook, including migrations, backups, secret rotation and incident playbooks:
[docs/operations.md](docs/operations.md).

---

## Quality gates

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint .
npm test            # vitest run
```

CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs all four steps plus a real build on
every push and pull request to `main`, against a throwaway `postgres:16-alpine` service container.

Unit tests cover the security-critical pure logic: token signing/verification and expiry, scrypt
passcode and recovery-code verification, rate-limit windowing across both stores, transient database
error classification, and CSV escaping including formula injection.

---

## Security posture

| Control | Implementation |
|---|---|
| Admin sessions | HMAC-SHA256 signed, self-contained tokens (`x-admin-token`), 12-hour TTL, constant-time signature comparison, verified **before** the payload is parsed |
| Credentials at rest | scrypt with a per-record random salt; the plaintext passcode is never stored |
| Recovery | Single-use recovery codes (80 bits, 32-symbol unambiguous alphabet); a successful reset mints a replacement inside the same transaction |
| Rate limiting | Redis-backed fixed windows with named policies; login policy is **fail-closed**, public endpoints fail open so a broken cache never takes the site down |
| Content Security Policy | Per-request nonce, no `unsafe-inline` for scripts, explicit allowlists for the storage hosts (endpoint + public URL, injected from the same variables the uploader uses), Cloudinary and Google Fonts |
| Other headers | `nosniff`, `strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, restrictive `Permissions-Policy`, HSTS |
| Uploads | Presigned PUT minted server-side; the signature covers `Content-Type` **and** `Content-Length`, so the type and 5 MB limits are enforced by the bucket, not merely by the client. Image bytes go browser→bucket and never transit this app. Stored URLs are validated against the same origin allowlist the CSP `img-src` uses |
| CSV export | Leading `=`, `+`, `-`, `@`, tab and CR are prefixed with an apostrophe to defuse spreadsheet formula injection |
| Public form | Honeypot field, per-IP submission limit, control-character stripping, length caps |
| Proxy trust | `X-Forwarded-For` is honoured only with an explicit `TRUST_PROXY=1`, preventing IP spoofing |
| Startup | Misconfigured secrets are logged loudly at boot instead of surfacing as a confusing 401 at first login |

---

## Not in scope

There is deliberately no page builder, no multi-user accounts or roles (one shared passcode), no email
sending, and no payment processing. The admin API is authenticated by a single shared passcode, so
treat it as one trust level, not an accountability trail.
