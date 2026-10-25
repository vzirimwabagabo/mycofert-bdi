# Operations runbook

How to run, deploy, monitor and repair this application. Written for whoever
holds the server — not for the site owner (see [manual.md](manual.md)) and not
for people reading the code (see [architecture.md](architecture.md)).

- [Environments](#environments)
- [Environment variables](#environment-variables)
- [Local development](#local-development)
- [Database migrations](#database-migrations)
- [Build and release](#build-and-release)
- [Health checks and monitoring](#health-checks-and-monitoring)
- [Secret rotation](#secret-rotation)
- [Runbooks](#runbooks)
- [Database operations](#database-operations)
- [Rate-limit tuning](#rate-limit-tuning)
- [Post-deploy checklist](#post-deploy-checklist)

---

## Environments

| Environment | Database | Redis | Command | Notes |
|---|---|---|---|---|
| Local | Remote Neon, or the bundled `docker-compose.yml` Postgres 16 | none — in-memory store | `npm run dev` | Port 3000 |
| CI | `postgres:16-alpine` service container | none | see [ci.yml](../.github/workflows/ci.yml) | typecheck → lint → test → build |
| Production | Managed Postgres (Neon), pooled | Upstash Redis, required | `sh start.sh` in the built artifact | Behind Caddy |

The application runs on **multiple instances behind a load balancer**. Two
consequences that shape almost every decision below:

1. **No SQLite, no local files.** State must live in Postgres or Redis.
2. **Any in-process state is per-instance.** The in-memory rate-limit store and
   the analytics prune timer are per-instance by design; anything that must be
   global (rate limits in production, sessions) is either signed statelessly or
   stored in Redis.

---

## Environment variables

Copy [.env.example](../.env.example) for local work. In production set these in
the deployment secret store — **never** commit a populated `.env`.

### Required

| Variable | Purpose | If missing |
|---|---|---|
| `DATABASE_URL` | Postgres connection string. Add `connection_limit=1` and `pgbouncer=true` when it points at a pooler (Supabase port 6543, Neon `-pooler`, PgBouncer) | The app serves built-in placeholder content and the admin area fails |
| `ADMIN_SESSION_SECRET` | HMAC key for admin tokens. **≥ 32 characters**, identical on every instance | `503` on every admin route; `instrumentation.ts` logs a warning at boot |
| `ADMIN_PASSCODE` | Initial dashboard passphrase, ≥ 12 characters | No way in until a recovery code exists. See [the precedence trap](#the-passcode-change-that-does-not-take-effect) |

### Required in production only

| Variable | Purpose |
|---|---|
| `RATE_LIMIT_REDIS_URL` + `RATE_LIMIT_REDIS_TOKEN` | Cross-instance rate limiting. Accepts the Upstash names as aliases |
| `DIRECT_URL` | Unpooled connection, used **only** by Prisma migrations |

> **Rotating `ADMIN_SESSION_SECRET` logs everyone out.** Every token signed with
> the old key fails signature verification. That is the intended behaviour.

### Optional

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_CONNECTION_LIMIT` | — | Pool size per instance, applied **only** to non-pooler URLs |
| `TRUST_PROXY` | unset | `1` when a proxy you control overwrites `X-Forwarded-For` |
| `PAGEVIEW_RETENTION_DAYS` | `365` | Analytics retention; `0` disables pruning |
| `STORAGE_ENDPOINT` / `_REGION` / `_BUCKET` / `_ACCESS_KEY_ID` / `_SECRET_ACCESS_KEY` + `NEXT_PUBLIC_STORAGE_PUBLIC_URL` | — | Upload target. All six together, or none — see [Object storage](#object-storage) |
| `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` | — | Fallback upload target, used only while `STORAGE_*` is unset |
| `SITE_URL` | `https://mycofert.bi` | Canonical URL used in metadata and the sitemap |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | — | Accepted as aliases for `RATE_LIMIT_REDIS_URL` / `_TOKEN` |

### Two variables whose *absence* is the correct setting

- **`TRUST_PROXY`** — leaving it unset is safe and spoof-proof: rate limiting
  falls back to a shared bucket for unknown IPs. Set it to `1` **only** when a
  proxy you fully control rewrites `X-Forwarded-For` first. The bundled Caddyfile
  does exactly that, which is why `start.sh` defaults it to `1`.
- **Cloudinary** — leaving all three blank disables the fallback cleanly; the local
  image library keeps working. **Do not put dummy values in**: any non-empty
  trio makes the app believe Cloudinary is configured, and the first upload
  fails with a confusing `401` from Cloudinary itself rather than a clear
  "not configured" `503`.

---

## Object storage

Uploads are presigned server-side and sent **directly from the browser to the
bucket**, so the app never handles image bytes. Which bucket is a configuration
decision: the storage provider is chosen by the environment, not by the code.

Supported, out of the box: **Supabase Storage**, **Neon Object Storage**,
Cloudflare R2, Backblaze B2, AWS S3 — anything speaking S3.

| Variable | Value |
|---|---|
| `STORAGE_ENDPOINT` | Supabase: `https://<ref>.supabase.co/storage/v1/s3` · Neon: `https://<bucket>.storage.<region>.aws.neon.tech` |
| `STORAGE_REGION` | The bucket's region. Defaults to `auto` when unset |
| `STORAGE_BUCKET` | Bucket name |
| `STORAGE_ACCESS_KEY_ID` / `STORAGE_SECRET_ACCESS_KEY` | Access keys from the provider (Supabase: Storage → Settings → S3 Access Keys) |
| `NEXT_PUBLIC_STORAGE_PUBLIC_URL` | Public base URL objects are served from, without a trailing slash |

**Three things that must be true or uploads fail in confusing ways:**

1. **Bucket CORS.** The browser `PUT`s cross-origin, so the bucket needs a CORS
   rule allowing `PUT` from the site origin with the `content-type` header. A
   missing rule surfaces in the dashboard as
   *"Could not reach the storage bucket"* — a transport-level failure that looks
   like a network problem but is not.
2. **Objects readably.** Either the bucket is public, or the public URL is
   servable some other way. The app stores that URL verbatim and validates it
   against `NEXT_PUBLIC_STORAGE_PUBLIC_URL`, so a URL that is not renderable is
   rejected at the API with `400 Invalid image URL`.
3. **The public URL is inlined at build time.** `NEXT_PUBLIC_*` is compiled into
   the client bundle: changing this one value requires a **rebuild**, not just a
   restart. The server-side half of the app picks it up at runtime, so a
   forgotten rebuild shows the *new* URL passing validation on the server while
   the *old* one is baked into the browser's copy of the allowlist.

**Rotating storage keys.** Create a second access key at the provider, update
`STORAGE_ACCESS_KEY_ID` / `STORAGE_SECRET_ACCESS_KEY`, restart, upload a test
image, then revoke the old key. A single key is rotated in place instead:
generate, update, restart, verify.

> The storage access keys bypass any bucket policy the provider applies to public
> keys. They are server-only; never prefix them with `NEXT_PUBLIC_`.

**Switching provider (e.g. Cloudinary → Supabase Storage).** Fill in the six
storage values and restart; the next upload goes to the new bucket. Images
already stored keep working because `res.cloudinary.com` stays in the URL
allow-list — see [Storage and backups](#storage-and-backups) for clearing them
out later.

---

## Local development

```bash
npm install
docker compose up -d          # local Postgres 16 — or skip and use a remote URL
cp .env.example .env          # then fill in the values
npm run db:migrate            # create the schema
npm run db:seed               # optional sample content
npm run dev                   # http://localhost:3000
```

`predev` regenerates `src/lib/image-manifest.json` before the server starts, so
renaming an image in `public/images/` takes effect on the next run with no code
change. Supported extensions, in priority order: `avif`, `webp`, `jpg`, `jpeg`,
`png`, `gif`, `svg`.

**Local Postgres is optional.** If Docker is unavailable, point `DATABASE_URL`
and `DIRECT_URL` at a remote managed instance instead. Remote Neon databases
cold-start slowly, so `connect_timeout` and `pool_timeout` should both be at
least 30 seconds in the connection string; the Prisma defaults of 15 s produce
`P2024` errors on the first request after an idle period.

### Quality gates

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint .
npm run test        # vitest run
```

All three must exit `0`. `next build` also refuses to ignore type errors
(`typescript.ignoreBuildErrors: false` in [next.config.ts](../next.config.ts)),
so a type error cannot reach production silently.

---

## Database migrations

| Situation | Command | What it does |
|---|---|---|
| Local, iterating | `npm run db:migrate` | `prisma migrate dev` — creates a migration file if the schema changed, applies it, regenerates the client |
| CI and production | `npm run db:deploy` | `prisma migrate deploy` — applies pending migrations only; never generates or resets |

**Order matters in a release:** `db:deploy` must run **before** the new
application version takes traffic. The old version tolerates the new schema
(migrations here are additive); the reverse is not guaranteed.

`prisma migrate deploy` uses `DIRECT_URL`. On Neon that means removing
`-pooler` from the host; on Supabase, port `5432` instead of `6543`. A migration
run through a transaction pooler can fail or hang.

```bash
npm run db:generate   # after editing prisma/schema.prisma
npm run db:studio     # browse the data
npm run db:reset      # DESTRUCTIVE: drops and recreates the database
```

---

## Build and release

```bash
npm run build   # next build && node scripts/prepare-standalone.mjs
npm start       # node .next/standalone/server.js
```

`output: "standalone"` produces `.next/standalone/server.js`, but Next does not
copy `.next/static` or `public/` into it. `scripts/prepare-standalone.mjs` does,
cross-platform — the previous Unix-only `cp -r` meant the artifact was unrunnable
on anything that was not Linux.

**`DATABASE_URL` is not needed at build time.** Prisma generates its types from
the schema file, not from a live database.

### The packaged artifact

`.zscripts/build.sh` produces `/tmp/build_fullstack_<id>.tar.gz` containing:

```
start.sh
Caddyfile
next-service-dist/
  server.js
  .next/static/
  public/
```

and `.zscripts/start.sh` (inside the artifact) then:

1. **Refuses to start without `DATABASE_URL`**, and rejects a `file:` URL
   outright — the schema is PostgreSQL-only and a SQLite URL would fail at the
   Prisma layer anyway.
2. Logs the database host **without the password**.
3. Exports `NODE_ENV=production`, `PORT` (default 3000), `HOSTNAME` (default
   `0.0.0.0`) and `TRUST_PROXY` (default `1`).
4. `exec node server.js` in `next-service-dist/`.

A subtlety worth knowing before debugging a failed build: if
`.next/standalone/server.js` is absent, `build.sh` checks `next.config.*` — if
`output: "standalone"` is declared but no artifact appeared, it **fails loudly**
rather than continuing with something unrunnable. If the option is not declared
at all, it injects it, rebuilds, and keeps a `.zbak` of the original config.

### TLS and the reverse proxy

[Caddyfile](../Caddyfile) terminates TLS (automatic ACME certificates) and
reverse-proxies to `localhost:3000`, **overwriting** `X-Forwarded-For`,
`X-Forwarded-Proto` and `X-Real-IP` from the socket address. Replacing the
hostname `{$DOMAIN:localhost}` with the real domain is the only edit a normal
deployment needs.

> A `?XTransformPort=` block used to sit in this file. It proxied to **any**
> localhost port on request — an SSRF primitive that turned the proxy into a
> port scanner for anyone who could reach the site. It has been removed; the
> comment in the file records why. Do not reintroduce anything similar.

---

## Health checks and monitoring

| Probe | Question | Cost | Recommended use |
|---|---|---|---|
| `GET /api/health` | Is the instance alive? | none | LB **liveness** — a DB blip must not restart every instance |
| `GET /api/health?deep=1` | Is the instance ready? | one `SELECT 1` | LB **readiness** — pull a broken instance out of rotation |

Deep-probe response fields:

```json
{
  "status": "ok",
  "uptime": 812,
  "timestamp": "2026-10-25T09:14:02.113Z",
  "database": { "status": "ok", "latencyMs": 41 },
  "content":  { "degraded": false, "lastFallbackAt": null }
}
```

### What to alert on

| Signal | Meaning | Severity |
|---|---|---|
| Deep probe `503` | The database is unreachable from this instance | Page |
| `database.latencyMs` climbing past a few hundred ms | Neon cold start, or a connection-starved pool | Warn |
| `content.degraded: true` | **The site is up but showing placeholder content.** The DB read failed and built-in defaults are being served | Page — the most deceptive failure mode here |
| `X-Content-Degraded: 1` on `/api/content` | Same condition, seen from the page's own fetch | Page |
| `429` rate on `/api/admin/auth` | Either a brute-force attempt, or Redis is down (see below) | Warn |

`content.degraded` deliberately does **not** change the status code — a ready
instance should stay in rotation while serving slightly-stale content. It has to
be alerted on separately, because nothing else will notice.

---

## Secret rotation

**Restart, not rebuild.** No `NEXT_PUBLIC_*` variable exists in this project, so
**no secret is embedded in the client bundle**. Every value is read at runtime
on the server. Changing a variable requires restarting the process; it does not
require a new build.

### Order of operations, for any secret

1. Create the new credential at the provider (keep the old one active).
2. Update the deployment secret store.
3. **Restart** all instances.
4. Verify: log in, submit an inquiry, upload an image, check `/api/health?deep=1`.
5. Revoke the old credential at the provider.

### Neon database password

Neon gives you a *pooled* host (`...-pooler...`) and a *direct* host. You must
update **both**:

- `DATABASE_URL` → pooled host, with `connection_limit=1` and `pgbouncer=true`
- `DIRECT_URL` → direct host (no `-pooler`), used by migrations

Updating only `DATABASE_URL` leaves migrations pointed at a credential that no
longer exists — which usually surfaces much later, during a deploy, as a
confusing authentication failure.

### Upstash Redis token

`RATE_LIMIT_REDIS_URL` and `RATE_LIMIT_REDIS_TOKEN` (or the `UPSTASH_REDIS_REST_*`
aliases). Rotate the token, restart, then confirm that a deliberately wrong admin
passcode still returns `401` and not `429`.

> #### The `429` that is really Redis
>
> `LIMIT_ADMIN_AUTH` **fails closed**. If the Redis store is unreachable or the
> token is wrong, `/api/admin/auth` rejects the request — reporting `429 Too many
> attempts`, which looks exactly like a lockout and nothing like an
> infrastructure failure. If the owner suddenly cannot log in and the passcode
> is definitely right, check the Redis credentials **before** resetting anything.
>
> The other three policies fail open, so this symptom is specific to the login
> endpoint.

### Cloudinary API secret

`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`. Uploads
are signed server-side, so only the secret needs rotating. Restart, then upload
one test image.

A `401` **from Cloudinary** (not from this app) almost always means
`CLOUDINARY_CLOUD_NAME` holds the **upload preset name** instead of the account
cloud name. In the Cloudinary console, "API environment variable" reads
`cloudinary://<api_key>:<api_secret>@<cloud_name>` — the cloud name is the short
random string, not the brand name.

### `ADMIN_SESSION_SECRET`

Rotating it invalidates every existing session immediately. It must be **≥ 32
characters and identical on every instance** — a mismatch means a token issued by
one instance is rejected by another, which appears as intermittent, inexplicable
logouts.

### `ADMIN_PASSCODE`

Usually you should not rotate this by hand at all — the owner changes it in the
dashboard, and from that moment the database hash wins. See below.

---

## Runbooks

### 500s in the admin dashboard, or `P2024`

**Symptom.** The dashboard shows an error, or the server log repeats
`Timed out fetching a new connection from the connection pool`.

**Cause.** The Neon pool is configured with `connection_limit=1`. Parallel
queries queue behind one another, and each pays a full network round trip; on a
slow link that exceeds the pool timeout. This is why the admin data routes batch
five queries into one `db.$transaction` — one round trip instead of five.

**Check.**

1. Confirm the connection string really carries `connection_limit=1` and
   `pgbouncer=true`. Without `pgbouncer=true`, Prisma does not recognise the URL
   as pooled and `DATABASE_CONNECTION_LIMIT` is ignored.
2. Confirm `connect_timeout` and `pool_timeout` are ≥ 30 s. The Prisma defaults
   of 15 s are too short for a cold Neon instance.
3. Check whether the route returns `503` with `Retry-After: 5` and
   `X-Db-Unavailable: 1`. That is the designed response to a transient stall,
   and the dashboard retries automatically — it does **not** log the user out.

**Note.** `src/lib/db-retry.ts` already retries `P1001`, `P1002`, `P1008`,
`P1017`, `P2024`, `ECONNRESET`, `ETIMEDOUT`, `ECONNREFUSED`, `EPIPE` and
`ENOTFOUND`. A `503` reaching the browser means the retries were exhausted.

---

### "The site is up but the content is wrong"

**Symptom.** Pages load fine but show the built-in default products and news.
Nobody notices unless they know the real content.

**Cause.** A database failure in `getPublicContent()` — it never throws, so the
page renders anyway from `DEFAULT_PRODUCTS` / `DEFAULT_NEWS`.

**Detect.**

```bash
curl -sD - -o /dev/null https://<host>/api/content | grep -i x-content-degraded
curl -s https://<host>/api/health?deep=1 | grep -o '"degraded":[a-z]*'
```

**Act.** This is a database problem, not a content problem. Do not re-enter the
content: the rows are almost certainly still there. Check the database first —
the `lastFallbackAt` timestamp tells you when it started.

---

### The owner is locked out

Work outwards, cheapest first.

1. **Is it a lockout?** `/api/admin/auth` returns `429`. Wait 15 minutes (the
   `LIMIT_ADMIN_AUTH` window) — or check Redis, because a broken Redis also
   produces `429` (see [above](#the-429-that-is-really-redis)).
2. **Is the server misconfigured?** `503 Admin authentication is not configured`
   means `ADMIN_SESSION_SECRET` is missing or shorter than 32 characters. Fix
   and restart.
3. **Is the passcode too weak?** `400 ... too weak (minimum 12 characters)` means
   the *configured* passcode fails the length rule. This is an operator error,
   reported distinctly so it is not mistaken for a wrong password.
4. **Use the recovery code.** The owner generates it in Admin → Settings →
   "Recovery code" while still logged in, and uses it on the login screen's
   "forgot passcode" path. Using it **consumes** it and returns a replacement in
   the same response. Older codes are invalidated whenever a new one is issued.
5. **Last resort — clear the stored hash.** If no recovery code was ever
   generated, nothing in the application can help:

   ```bash
   npm run db:studio
   # SiteSetting → delete the row with key = 'admin_passcode_hash'
   # Then restart. ADMIN_PASSCODE from the environment applies again.
   ```

   This is exactly what the `no-recovery-code` error message is telling the
   owner to ask for.

---

### The passcode change does not take effect

**Symptom.** `ADMIN_PASSCODE` in the environment was changed and restarted, but
the old passcode still works, or the new one does not.

**Cause.** This is by design. Once the passcode is changed from the dashboard
(or reset with a recovery code), a salted scrypt hash is written to the
`admin_passcode_hash` setting, and **the database record takes precedence over
the environment variable from then on**.

**Fix.** Do not edit the environment. Use the dashboard, a recovery code, or —
as a last resort — delete the `admin_passcode_hash` row as above. The
environment variable is only ever the *initial* value.

---

### Rolling back a release

The artifact is self-contained and version-named
(`/tmp/build_fullstack_<id>.tar.gz`), so a rollback is redeploying the previous
tarball.

**Caution with migrations.** `prisma migrate deploy` never rolls back. If the
previous release predates a migration, confirm the older code tolerates the
newer schema before switching — migrations here are additive, so this is usually
fine, but check the migration file rather than assuming.

---

## Database operations

### Connection sizing

```
total connections = instances × connection_limit
```

Keep that product below the database's `max_connections`. With a Neon pooler,
`connection_limit=1` per instance is correct and is already encoded in the
connection string. On a direct connection, set `DATABASE_CONNECTION_LIMIT`
instead — the application appends it automatically, and only when the URL does
not already carry a limit.

### Analytics retention

`PageView` rows older than `PAGEVIEW_RETENTION_DAYS` (default 365) are deleted
opportunistically, at most once per hour **per instance**. With several
instances, deletes happen slightly more often than hourly — harmless, because
each is idempotent.

Set `PAGEVIEW_RETENTION_DAYS=0` to disable pruning entirely. Do that only if you
have another retention mechanism, because the dashboard's "top pages" aggregate
scans the whole table.

### Backups

Managed Postgres (Neon, Supabase) provides point-in-time recovery — use the
provider's console. There is no application-level backup.

Two things are **not** in the database and are worth keeping a copy of:

- `public/images/` — the local image library
- The Cloudinary assets referenced by `Product.imageUrl` / `NewsPost.imageUrl`

Deleting a product or news post permanently removes its row (no soft-delete, no
undo). The Cloudinary asset survives, but nothing points at it any more.

### Inspecting data

```bash
npm run db:studio
```

The tables that matter operationally: `SiteSetting` (rows `admin_passcode_hash`,
`admin_recovery_hash`, `seeded`, and the page content blobs), `Inquiry`,
`PageView`, `Product`, `NewsPost`.

---

## Rate-limit tuning

Policies live in [src/lib/rate-limit.ts](../src/lib/rate-limit.ts).

| Policy | Limit / window | `unknownLimit` | Fails |
|---|---|---|---|
| `LIMIT_ADMIN_AUTH` | 8 / 15 min (60 in dev) | none | closed |
| `LIMIT_INQUIRIES` | 10 / 10 min | 60 | open |
| `LIMIT_TRACK` | 120 / 5 min | 3000 | open |
| `LIMIT_ADMIN_API` | 300 / 5 min | 1200 | open |

- **`unknownLimit`** applies when the client IP cannot be determined — which is
  the normal case unless `TRUST_PROXY=1`. Without it, every visitor would share
  a single bucket and one busy client would lock out the site.
- **`LIMIT_ADMIN_AUTH` deliberately has no `unknownLimit`.** A strict global
  login cap is exactly what is wanted under attack.
- **`failClosed: true`** on `LIMIT_ADMIN_AUTH` means an unreachable store rejects
  the request. Correct for a login endpoint (no passcode guessing during an
  outage), but it is the source of the confusing `429` described above.

Changing a limit requires a restart. Limits are per-instance unless Redis is
configured — **always configure Redis in production**, or a limit of 8 becomes
8 × the number of instances.

---

## Post-deploy checklist

1. `GET /api/health` → `200`, `status: "ok"`.
2. `GET /api/health?deep=1` → `200`, `database.status: "ok"`,
   `content.degraded: false`.
3. `GET /api/content` → no `X-Content-Degraded` header.
4. Log in at `/admin` with the current passcode.
5. Submit a test inquiry through the contact form; confirm it appears in
   Admin → Inquiries; delete it.
6. Upload one test image; confirm it lands in Cloudinary and renders.
7. Confirm a wrong passcode returns `401` — **not** `429` (which would mean
   Redis is misconfigured).
8. Confirm the browser console has no CSP violations.
9. Verify the response headers: `Content-Security-Policy` present with a
   per-request nonce, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
   no `X-Powered-By`.
10. Confirm `https://<host>/api/admin/data` without a token returns `401`, and
    that the response carries `Cache-Control: no-store`.
