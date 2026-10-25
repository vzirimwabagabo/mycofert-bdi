# Architecture

How MYCOFERT Burundi is put together, and **why** each decision was made. For the endpoints
themselves see [api.md](api.md); for running and operating the system see [operations.md](operations.md).

---

## 1. System overview

```
                    ┌──────────────────────────────────────────┐
   Visitor ────────►│  Caddy  (TLS, ACME certs, reverse proxy) │
                    │  overwrites X-Forwarded-For / X-Real-IP  │
                    └───────────────────┬──────────────────────┘
                                        │  HTTP :3000
                    ┌───────────────────▼──────────────────────┐
                    │  Next.js 16 standalone server            │
                    │                                          │
                    │  proxy.ts ──► per-request CSP nonce      │
                    │  instrumentation.ts ──► startup checks   │
                    │                                          │
                    │  app/[[...slug]]/page.tsx   (SSR shell)  │
                    │  app/api/**/route.ts        (JSON API)   │
                    │                                          │
                    │  components/site/*  (client app)         │
                    │  lib/*              (shared logic)       │
                    └───────┬──────────────────┬───────────────┘
                            │                  │
              ┌─────────────▼───────┐   ┌──────▼─────────────┐
              │ PostgreSQL 16       │   │ Upstash Redis      │
              │ (Supabase or Neon)  │   │ (rate limits)      │
              │ 4 tables            │   │ OPTIONAL           │
              └─────────────────────┘   └────────────────────┘
                            ▲
                            │  stores only the returned URL
                            │
   Admin browser ──────► S3-compatible bucket   (image bytes go browser→bucket
                         (or Cloudinary)         directly, presigned by the server)
```

Design constraints that shaped everything below:

| Constraint | Consequence |
|---|---|
| Runs on **multiple instances behind a load balancer** | No in-process session store; sessions must be self-verifiable. No SQLite. |
| Database is a **remote pooler with `connection_limit=1`** | Query batching is mandatory; parallel queries deadlock under latency. |
| The site owner is **non-technical and has no IT support** | No `.env` editing for routine tasks; no email dependency for recovery. |
| The marketing site must stay **up and indexable** even if the database is asleep | Server-rendered HTML, plus a visible-but-working content fallback. |
| Uploads must not be locked to **one storage vendor** | Presigned S3 PUTs, with Cloudinary kept as a fallback; only the endpoint and public URL base come from the environment. |

---

## 2. Request lifecycle (server render)

`src/app/[[...slug]]/page.tsx` is a single catch-all route that serves every public URL.

1. **`proxy.ts`** runs first on every matching request. It generates a fresh 16-byte nonce, builds a
   nonce-based `Content-Security-Policy`, attaches it to both the request headers (as `x-nonce`, so
   `layout.tsx` can stamp Next.js' script tags) and the response. Prefetch requests are excluded via
   the matcher's `missing` conditions.
2. **Route parsing.** The page reads the `slug` params and calls `routeFromParams()` →
   `parseSegments()` from `src/lib/route.ts` — the *same pure function* the client uses. Identical
   input, identical output, on both sides.
3. **Content loading.** `getPublicContent()` (see §5) returns settings, published products and
   published news. It is batched and retry-wrapped.
4. **404s.** An unparseable path calls `notFound()`. A `news-post` route whose slug matches no
   *published* post also calls `notFound()` — a dead link is a 404, not a silent redirect to the
   listing.
5. **Metadata.** `generateMetadata()` produces the title, description and `hreflang` alternates
   (`fr`/`en` plus `x-default`) for the resolved route.
6. **Shell render.** The page returns `<SiteShell initialRoute={route} initialContent={content} />`.
   The server HTML therefore already contains the correct language, the correct page and the real
   content — the client bundle is an enhancement, not a prerequisite.

`export const dynamic = 'force-dynamic'` on the page and on the public content route: content is
edited from the dashboard and must appear immediately, so nothing is statically cached.

---

## 3. Routing model

### Real paths, not hashes

Every public page is an indexable path with a language prefix:

| Page | Canonical | Accepted aliases |
|---|---|---|
| Home | `/{lang}` | — |
| Products | `/{lang}/products` | `produits` |
| About | `/{lang}/about` | `a-propos` |
| Sustainability | `/{lang}/sustainability` | `durabilite` |
| Training | `/{lang}/training` | `formation` |
| News | `/{lang}/news` | `actualites` |
| News article | `/{lang}/news/{slug}` | — |
| Contact | `/{lang}/contact` | — |
| Admin | `/admin` | — |

`src/lib/route.ts` is **pure** — no React, no `window` — which is what lets the server and the client
share one parser. `PageId` is the closed union of page identities:

```
home · products · about · sustainability · training · news · news-post · contact · admin
```

`hrefFor(lang, page, slug?)` is the single place that builds a URL, so no component hand-writes a
path.

### The client-side router

`src/components/site/context.tsx` keeps the URL as the source of truth. There is **no** React state
holding "the current page"; instead:

- An **external store** (`extState` + listener set) holds `{ path, storedLang }`.
- `useSyncExternalStore` subscribes to it. The store's **server snapshot is empty**, so the server
  render and the client's first (hydration) render are byte-identical — the real browser state is
  adopted only *after* hydration from a `useEffect`. Any difference is then a normal re-render, never
  a hydration mismatch. This is the reason for the slightly unusual two-snapshot setup.
- `navigate(page, slug?)` calls `window.history.pushState()` and scrolls to top.
- `setLang(lang)` persists to `localStorage` under `mycofert-lang` and pushes the same page in the
  new language. On `/admin` (which has no language segment) it only updates the stored preference.
- A `popstate` listener re-syncs the store so Back/Forward work.
- A bare `/` is canonicalised with `replaceState` to `/{storedLang ?? 'fr'}` — no reload, no extra
  history entry.

`useSite()` exposes `{ route, lang, t, navigate, setLang }`.

The admin path is deliberately *not* language-prefixed: the dashboard is an internal tool, and a
passcode-protected URL is easier to remember and to bookmark.

---

## 4. Internationalisation

`fr` is the **source of truth**. `src/lib/i18n/fr.ts` defines the object and then exports
`export type Dict = typeof fr`. `src/lib/i18n/en.ts` is declared as `const en: Dict = { … }`.

The consequence is a compile-time guarantee: **adding a French key without an English one fails
`tsc`**. There is no runtime fallback that can silently ship a half-translated page, and no
translation-key linting tool is needed.

- `Lang = 'fr' | 'en'`; `DEFAULT_LANG = 'fr'`.
- `getDict(lang)` returns the dictionary, falling back to `fr` for an unknown code.
- Component text is read as `t.someGroup.someKey` — typos are type errors, not blank labels.
- Bilingual *content* (products, news, editable settings) is stored as separate `...Fr` / `...En`
  columns in the database and narrowed at render time by `pick(text, lang)`:

  ```ts
  lang === 'en' ? text.en || text.fr : text.fr || text.en
  ```

  So a field the owner left blank in one language never renders empty — it falls back to the other.
- News posts set their own `document.title` because React runs child effects before parent effects,
  and the parent effect would otherwise overwrite it.

---

## 5. Content layer

### Server side — `src/lib/cms-server.ts`

| Function | Used by | Returns |
|---|---|---|
| `getPublicContent()` | `app/[[...slug]]/page.tsx`, `/api/content` | settings + **published** products/news |
| `getAdminContent()` | `/api/admin/content` | settings + **all** products/news, including hidden |
| `ensureSeeded()` | both | Seeds default products/news/settings once, guarded by a `seeded` flag row |
| `getContentHealth()` | `/api/health?deep=1` | `{ degraded, lastFallbackAt }` |

Rows are converted to compact DTOs (`productDto`, `newsDto`) where bilingual pairs become
`{ fr, en }` objects and multi-line text becomes arrays. The database never leaks its column naming
into the UI.

### The fallback, and why it is loud

`getPublicContent()` is batched into a single `db.$transaction([...])` and wrapped in `withDbRetry`.
If it still fails — a cold serverless instance, a network partition — it **does not throw**. It returns the
built-in defaults from `cms-defaults.ts` and records the timestamp in `contentFallbackAt`.

Rationale: an outdated marketing page is better than a 500 for a customer. But a silent fallback is
dangerous — an outage would look like a healthy site quoting the wrong products and prices. So the
degradation is explicitly advertised in two places:

- `/api/content` sets `X-Content-Degraded: 1` on the response.
- `/api/health?deep=1` reports `content: { degraded, lastFallbackAt }`.

### Client side — `src/components/site/cms.tsx`

`CmsProvider` receives the server-rendered `initialContent` for hydration, then refetches
`/api/content` on mount (if it was not supplied) and on **every path change** via `onPathChange()`.
On a failed refetch it keeps the content already on screen rather than blanking the page.

### Defaults and the image library — `src/lib/cms-defaults.ts`

- `DEFAULT_PRODUCTS` / `DEFAULT_NEWS` are derived from the French dictionary, so the CMS starts
  pre-filled and the first-run experience is never an empty dashboard.
- `SETTING_KEYS = ['contact','home','training','about','sustainability']` — the editable groups.
- `IMAGE_LIBRARY` is a fixed set of nine slots:

  ```
  fresh · dried · powder · packaged · substrate · fertilizer · sustainability · training · hero
  ```

- **`resolveImage(item)` precedence:** a stored `imageUrl` (object storage, or a legacy Cloudinary URL)
  always wins; otherwise fall back to `imageSrc(imageKey)`. The URL is run through
  `isAllowedImageUrl()` first — it arrives from the database, so rendering it unchecked would turn any
  write path that bypasses the admin API into stored XSS.
- `imageSrc(key)` reads `image-manifest.json`, which is **generated at build time** by
  `scripts/gen-image-manifest.mjs`. Scanning the directory means `fresh.webp` and `fresh.jpg` resolve
  exactly like `fresh.png`, with a documented format priority
  (`avif → webp → jpg → jpeg → png → gif → svg`) and a warning when a slot exists twice. This removes
  the "replace the PNG with a JPG and the site breaks" failure mode, and lets a non-technical owner
  swap images by dropping files into `public/images/`.

---

## 6. Data model

```
Inquiry                          PageView
  id        cuid                   id        cuid
  name, phone, email?              path
  type      product|bulk|          lang
            fertilizer|training|   createdAt
            partnership            PK(id)
  product?
  message                          idx(path), idx(createdAt)
  lang      fr|en
  status    new|handled
  createdAt
  PK(id)
  idx(createdAt DESC)              SiteSetting
  idx(status)                        key      PK   ('contact','home','training',
  idx(type)                                            'about','sustainability',
  idx(status, createdAt DESC)                          'seeded',
                                                       'admin_passcode_hash',
Product ←──────────────────────────┐                   'admin_recovery_hash')
  id, slug UNIQUE, sortOrder,      │                 value    TEXT (JSON)
  published, imageKey, imageUrl?   │                 updatedAt
  nameFr/En, taglineFr/En,         │
  descFr/En, pointsFr/En,          │
  formatsFr/En                     │
  createdAt, updatedAt             │
  idx(published, sortOrder)        │
                                   │
NewsPost                           │
  id, slug UNIQUE, published,      │
  imageKey, imageUrl?              │
  dateFr/En, titleFr/En,           │
  excerptFr/En, bodyFr/En          │
  createdAt, updatedAt             │
  idx(published, createdAt DESC)   │
```

### Why PostgreSQL and not SQLite

The app runs on multiple instances behind a load balancer. SQLite is a single file with a single
writer and cannot be shared between them. The schema, the migration history and `start.sh` all reject
a `file:` URL explicitly, so the mistake fails loudly instead of producing a corrupt half-working
deployment.

### Why every index exists

Indexes were added for observed query patterns, not speculatively:

| Index | Serves |
|---|---|
| `Inquiry(createdAt DESC)` | Dashboard default view, newest first |
| `Inquiry(status)` | The "new" badge count and the handled toggle |
| `Inquiry(type)` | The "by subject" breakdown |
| `Inquiry(status, createdAt DESC)` | The combined "filter by status, newest first" listing |
| `PageView(path)` | Top-pages grouping |
| `PageView(createdAt)` | Retention pruning and time windows |
| `Product(published, sortOrder)` | Public listing in display order |
| `NewsPost(published, createdAt DESC)` | Public listing, newest first |
| `Product.slug` / `NewsPost.slug` UNIQUE | Slug integrity; a duplicate is a `409`, not a silent overwrite |

### Why bilingual columns instead of a translation table

There are exactly two languages and both are part of the product spec. Two columns per field keep
every read a single row, make the admin form trivially simple (two inputs side by side), and let
`pick()` do the narrowing. A `Translation` join table would add a join to every read for no benefit
at this scale.

---

## 7. Admin authentication

`src/lib/auth.ts`. Requirements: no server-side session store (multiple instances), the token must
not reveal the passcode, verification must be constant-time, and it must fail closed.

### Token format

```
<payloadB64>.<signatureB64>

payloadB64   = base64url(JSON.stringify({ sub, iss, iat, exp, jti }))
signatureB64 = base64url(HMAC-SHA256(payloadB64, ADMIN_SESSION_SECRET))
```

- The signature covers the **encoded payload string**, so verification never has to re-canonicalise
  JSON — a classic source of signature-bypass bugs.
- **Signature is checked before the payload is parsed.** An unauthenticated payload is never fed to
  `JSON.parse`.
- Comparison uses `timingSafeEqual` with a length pre-check, so a signature cannot be recovered
  byte-by-byte through timing.
- `iss` must equal `mycofert-admin`, `exp` must be a number greater than now.
- `TOKEN_TTL_SECONDS = 12 * 60 * 60` (12 hours). Stateless design means there is no revocation list,
  so the TTL is the bound on the blast radius of a stolen token.
- Sent in the `x-admin-token` header (`ADMIN_TOKEN_HEADER`) and kept in `sessionStorage` on the client
  (`mycofert-admin-token`) — cleared when the tab closes.

### Credentials at rest

The passcode is never stored in plaintext. The dashboard writes a **scrypt** hash (16-byte random
salt, 64-byte derived key) into `SiteSetting.admin_passcode_hash` as `{ hash, salt, updatedAt }`.
Verification recomputes and compares with `timingSafeEqual`.

### Precedence, and the trap it creates

```
verifyPasscode(candidate):
  1. SiteSetting.admin_passcode_hash  ← wins when present
  2. ADMIN_PASSCODE environment variable ← initial value only
```

`ADMIN_PASSCODE` is the **bootstrap** passcode. The moment the owner changes it — or resets it — the
database row exists and the environment variable is ignored forever after. Editing `.env` will
therefore *not* recover a forgotten passcode. This is documented in `.env.example`, in the operator
manual and in the operations runbook, because it is the single most likely source of a support call.

### Recovery codes

The supported way back in, designed for an owner with no IT support and no email service:

- Generated while signed in, from the dashboard.
- 32-symbol alphabet excluding look-alikes (`I`, `O`, `0`, `1`), 16 characters in four groups —
  16 × log2(32) = **80 bits**, formatted `XXXX-XXXX-XXXX-XXXX` so it can be copied onto paper.
- Stored only as a scrypt hash (`SiteSetting.admin_recovery_hash`), like the passcode.
- Matching is case- and separator-insensitive, so a hand-typed code still works.
- **Single use.** A successful reset writes the new passcode *and* a replacement recovery code in one
  `db.$transaction`, so there is no window where the old code is spent and no new one exists.
- Sessions issued before a reset stay valid until they expire — the design is stateless, there is
  nothing to revoke. Callers must not imply otherwise.

### Fail closed

`isAuthConfigured()` is false when `ADMIN_SESSION_SECRET` is missing or shorter than 32 characters.
Routes then answer `503` — a clear "not configured" — instead of `401`, which would look like a wrong
passcode. A passcode shorter than `MIN_PASSCODE_LENGTH = 12` is refused at issue time rather than
protecting customer data with a guessable phrase. `instrumentation.ts` runs these checks at boot so
the problem is loud in the logs immediately.

---

## 8. Rate limiting

`src/lib/rate-limit.ts`. Two interchangeable stores behind one interface:

| Store | When | Behaviour |
|---|---|---|
| `RedisStore` | `RATE_LIMIT_REDIS_URL`/`_TOKEN` (or the `UPSTASH_REDIS_REST_*` aliases) is set | `POST {url}/pipeline` with `Authorization: Bearer <token>`, `cache: 'no-store'`, 1.5 s `AbortSignal.timeout`. Atomic `INCR` + `EXPIRE`, so counters are shared across instances. |
| `MemoryStore` | No Redis configured | Fixed-window counter per instance, opportunistic sweep every 60 s. Warns in production. |

Policies are named constants so a limit appears in exactly one place:

| Policy | Limit | Window | `unknownLimit` | Fail mode |
|---|---|---|---|---|
| `LIMIT_ADMIN_AUTH` | 8 in production / 60 otherwise | 15 min | — | **fail-closed** |
| `LIMIT_INQUIRIES` | 10 | 10 min | 60 | fail-open |
| `LIMIT_TRACK` | 120 | 5 min | 3000 | fail-open |
| `LIMIT_ADMIN_API` | 300 | 5 min | 1200 | fail-open |

Two points of subtlety worth knowing:

**`failClosed` on login is deliberate.** If the rate-limit store is broken, login is refused rather
than left unbounded — an attacker with a broken cache must not get unlimited passcode guesses. The
operational consequence: *a stale or rotated Redis token looks like a login lockout (`429`), not like
a Redis error.* This is called out in the operations runbook.

**`unknownLimit` exists because of `TRUST_PROXY`.** Without a trusted proxy the client IP is
unobtainable, so every anonymous visitor would share **one** bucket. A limit tuned for a single
abusive client would then throttle the whole site. For public endpoints the cap is raised; for login,
a strict global cap is exactly what is wanted under attack, so no `unknownLimit` is set.

Responses carry `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`, and `Retry-After` when
blocked.

Client identity is read from `x-forwarded-for` (leftmost entry only when `TRUST_PROXY=1`) or
`x-real-ip`; otherwise it is literally `'unknown'`. Honouring a client-supplied header without an
explicit opt-in would make the rate limit trivially spoofable.

---

## 9. Database resilience

Three mechanisms, in order of application:

**1. Query batching.** The pooler with `connection_limit=1` means parallel queries queue behind
each other and each pays its own network round trip; under latency this was producing `P2024`
(connection-pool timeout). Every multi-query read is therefore a single `db.$transaction([...])`:

| Route | Queries batched |
|---|---|
| `/api/admin/data` GET | 5 (paginated list, total count, status groups, path groups, type groups) |
| `/api/admin/content` GET | 3 |
| `/api/content` GET | 3 |

This turned seven round trips on the dashboard into one.

**2. Retry on transient failures.** `src/lib/db-retry.ts` distinguishes a *transient* failure from a
real bug and retries only the former, twice, 500 ms apart:

- Prisma codes: `P1001`, `P1002`, `P1008`, `P1017`, `P2024`
- Node codes: `ECONNRESET`, `ETIMEDOUT`, `ECONNREFUSED`, `EPIPE`, `ENOTFOUND`
- Plus message-pattern matching for socket/timeout wording

The module is deliberately **Prisma-free** so it can be unit-tested without a database.

**3. An explicit error contract.** When a stall survives the retry, admin routes answer
**`503` + `Retry-After: 5` + `X-Db-Unavailable: 1`** rather than a generic 500. This matters because
the admin UI must distinguish "the database is busy, try again" from "your session ended":

- `X-Db-Unavailable` → show a retry affordance, **stay signed in**.
- `401` / `X-Session-Expired` → sign the user out.

Conflating the two would log the owner out every time the database hiccuped.

Connection handling in `src/lib/db.ts`:

- `DATABASE_URL` already carrying `pgbouncer=true` or `connection_limit=` is used as-is;
  `DATABASE_CONNECTION_LIMIT` is appended only for direct connections. Total connections =
  instances × limit.
- Query logging is restricted to `['error']` in production. Prisma's `query` log writes every
  statement — including inquiry names, phone numbers and messages — into the container log, which
  would be a PII leak.
- A `globalThis` singleton prevents hot reload from opening a new pool each time in development.

---

## 10. Security controls

| Area | Implementation | File |
|---|---|---|
| CSP | Per-request cryptographic nonce; `'unsafe-inline'` is **not** allowed for scripts. `'unsafe-eval'` and `ws:`/`localhost` are added only outside production. | `src/proxy.ts` |
| CSP allowlists | `img-src` includes the bucket's public host, `res.cloudinary.com` and Google's hosts; `connect-src` includes the S3 endpoint and `api.cloudinary.com`. The storage origins are derived from `STORAGE_ENDPOINT` / `NEXT_PUBLIC_STORAGE_PUBLIC_URL`, so the policy and the uploader can never disagree. Nothing else. | `src/proxy.ts` |
| Static headers | `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Permissions-Policy` disabling camera/mic/geolocation/payment, HSTS | `next.config.ts` |
| Admin caching | `/api/admin/*` forced to `Cache-Control: no-store, max-age=0` | `next.config.ts` |
| Build integrity | `ignoreBuildErrors: false` — a type error fails the build rather than shipping silently; `poweredByHeader: false` | `next.config.ts` |
| Uploads | Presigned S3 `PUT` minted server-side, covering `Content-Type` **and** `Content-Length` — so the type allowlist and the 5 MB cap are enforced by the bucket, not just by the client. Image bytes go browser → bucket and never transit this app. | `src/lib/object-storage.ts` |
| Upload contract (shared) | One module defines the accepted MIME types, the 5 MB ceiling and the `accept=` attribute, so the picker never offers a file the server would reject. SVG is excluded on purpose: it can carry script, and objects are served from a public bucket. | `src/lib/uploads.ts` |
| Object keys | `mycofert/<yyyy>/<mm>/<uuid>.<ext>` — the uploaded filename is discarded, so `../`, control characters and a `.html` extension cannot reach the object path | `src/lib/object-storage.ts` |
| Storage credentials | `STORAGE_ACCESS_KEY_ID` / `STORAGE_SECRET_ACCESS_KEY` are server-only; they bypass the bucket's public-key policies | `src/lib/object-storage.ts` |
| Stored image URLs | `isAllowedImageUrl()` accepts only `https://` URLs on the configured storage origin or `res.cloudinary.com`, up to 1000 chars — mirroring the CSP `img-src` allowlist. Origins are compared **with** their trailing slash, so `res.cloudinary.com.example.org` cannot slip through as a prefix match. | `src/lib/image-url.ts` |
| CSV export | `csvCell()` doubles quotes per RFC 4180 **and** prefixes leading `=`, `+`, `-`, `@`, tab or CR with an apostrophe, defusing spreadsheet formula injection from a crafted inquiry | `src/lib/csv.ts` |
| Public form | Honeypot field (`website`): if filled, the request is silently accepted and discarded. Plus per-IP rate limit, control-character stripping, explicit length caps, and a type allowlist | `src/app/api/inquiries/route.ts` |
| Analytics input | `path` is length-capped and rejects `/undefined`, `/_next` and any value containing `.` | `src/app/api/track/route.ts` |
| Proxy trust | `X-Forwarded-For` honoured only with an explicit `TRUST_PROXY=1`, because the bundled Caddyfile overwrites it | `src/lib/rate-limit.ts`, `.zscripts/start.sh` |
| Removed SSRF primitive | The old Caddyfile `?XTransformPort=` sandbox-preview block proxied to *any* localhost service. It has been deleted. | `Caddyfile` |
| Startup visibility | Missing/short secrets are logged at boot | `src/instrumentation.ts` |

Two things the deployment must get right, because the app cannot compensate for them:

1. **`ADMIN_SESSION_SECRET` must be identical on every instance.** A token minted by one instance
   fails verification on another otherwise.
2. **The proxy must overwrite `X-Forwarded-For`** before `TRUST_PROXY=1` is set. The bundled
   `Caddyfile` does; a different front end must too.

---

## 11. Admin area

`src/components/site/admin.tsx` is the shell; four panels hang off it.

```
/admin
├─ not authenticated ──► passcode card
│                        ├─ "forgot passcode" ──► recovery form
│                        └─ "back to website"
└─ authenticated ─────► dashboard
                         header (site link, sign out)
                         Tabs (controlled)
                         ├─ inquiries  admin-inquiries.tsx   stats, table, CSV export
                         ├─ products   admin-products.tsx    CRUD, image picker
                         ├─ news       admin-news.tsx        CRUD, image picker
                         └─ content    admin-settings.tsx    contact/home/training/
                                                             about/sustainability
                                                             + security + recovery code
```

- **Session.** The token is read from `sessionStorage` on mount and sent as `x-admin-token` on every
  request via `authHeaders(token)`.
- **Reload semantics.** `loadError` is distinct from `authError`. Only `401` / `X-Session-Expired`
  clears the token; `X-Db-Unavailable` (503) surfaces a retry button and keeps the session.
- **Image upload** (`admin-ui.tsx`): POST `/api/admin/sign-upload` with
  `{ contentType, size }` → branch on the returned `provider`:
  - `storage` → `PUT` the file to the presigned `uploadUrl` with exactly the signed
    `Content-Type`, then store the returned `publicUrl`.
  - `cloudinary` → POST the file to
    `https://api.cloudinary.com/v1_1/{cloudName}/image/upload`, then store the returned `secure_url`.

  Image bytes never touch this server either way. The client validates the file against the same shared
  contract (`src/lib/uploads.ts`) before asking for a credential, and reports a transport-level `PUT`
  failure as a likely missing bucket CORS rule rather than an opaque network error.
- **CSV export** (`admin-inquiries.tsx`): builds RFC 4180 CSV with a UTF-8 BOM (so Excel opens the
  accents correctly), through `csvCell()`, as `mycofert-inquiries-{YYYY-MM-DD}.csv`.
- **Bilingual editing** is enforced by the form UI: `BiInput`, `BiTextarea` and `LangChip` present the
  FR/EN pair together so neither language is forgotten.
- **Loading states** use `PanelSkeleton` / `SkeletonList` shaped like the real content, so the layout
  does not jump when data lands. Skeletons appear only on the *first* load; a manual refresh keeps
  the numbers already on screen.

---

## 12. Guided tour

A first-party, dependency-free onboarding tour, because the owner is non-technical.

- **Structure** lives in `src/components/site/tour-steps.ts` (`TOURS.public`, `TOURS['admin-login']`,
  `TOURS.admin`); **wording** lives in the i18n dictionaries under `tour.steps.*`. `TourStepKey` is
  derived from the dictionary, so a step without text for a language is a compile error. Anchors are
  written down once rather than duplicated across `fr.ts` and `en.ts`.
- **Targeting** uses plain `data-tour="…"` attributes rather than refs, so the tour can point at
  elements it does not own.
- **A step can drive the app**: `page` navigates, `tab` selects a dashboard tab. The overlay then
  polls `requestAnimationFrame` until `[data-tour="…"]` exists with a non-zero box (up to
  `ANCHOR_TIMEOUT_MS = 2000`) and degrades to a centred card if it never appears — important because
  a stale token leaves the dashboard on the passcode screen.
- **Spotlight** is a single padded, ringed `div` with
  `boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)'` — no canvas, no four-div cut-out.
- **Accessibility**: focus moves into the card on each step, Tab is trapped inside it, arrow keys
  advance/retreat, Escape exits, and the counter is announced.
- **Mounted** in `shell.tsx` as `<TourProvider>` wrapping the app, with `<TourLauncher />` (a floating
  "Guide" menu, bottom-left) picking the public, admin-login or admin tour.

The same onboarding need is also served offline by [manual.md](manual.md), which is written for the
owner rather than for a developer.

---

## 13. UI layer conventions

- **`src/components/ui/`** holds shadcn-style wrappers over Radix primitives (`dialog`, `tabs`,
  `dropdown-menu`, `select`, `switch`, `toast`, `alert-dialog`, `sheet`, …) plus simple presentational
  pieces (`button`, `card`, `badge`, `table`, `input`, `label`, `separator`, `textarea`, `skeleton`).
  They are unmodified conventions, so upstream examples apply directly.
- **`cn()`** in `src/lib/utils.ts` — `twMerge(clsx(...))` — is the standard way to merge conditional
  Tailwind classes with correct precedence.
- **Tailwind v4** is CSS-first: theme tokens live in `src/app/globals.css` as custom properties, with
  a `.dark` variant. There is no `tailwind.config.js`.
- **Every file in `src/components/site/` is `'use client'`.** The server/client boundary is drawn at
  the route, not inside the page tree: `page.tsx` renders server-side and hands the client app its
  initial route and initial content as props. That keeps the SSR HTML complete while allowing the
  whole interactive shell to share context.
- **Toasts** come from `useToast()` (a module-level store, limit 1 toast at a time).

---

## 14. Analytics

First-party only — no third-party tracker, no cookies.

`SiteProvider` posts `{ path, lang }` to `/api/track` on every route change (aborting the previous
request via `AbortController`). The route stores a `PageView` row, rate-limited by `LIMIT_TRACK`, and
opportunistically prunes rows older than `PAGEVIEW_RETENTION_DAYS` (default 365) at most once an hour
per instance. `/api/track` always answers `200` — even when rate-limited it returns
`{ ok: false }` — so a client never retries in a loop.

The dashboard aggregates these rows by path to produce the "top pages" chart.

---

## 15. Testing strategy

`vitest`, Node environment, `src/__tests__/**/*.test.ts`. The suite deliberately targets the
**security-critical pure logic** — the parts where a subtle bug is a vulnerability rather than a
cosmetic defect, and which need no database to exercise:

| File | Covers |
|---|---|
| `auth.test.ts` | Token mint/verify round trip, tampered payload rejection, expired tokens, short-secret refusal, scrypt passcode and recovery-code verification |
| `rate-limit.test.ts` | Window arithmetic, limit enforcement, `unknownLimit` substitution, fail-open vs fail-closed |
| `db-retry.test.ts` | Transient vs non-transient classification, retry count and non-retry on real errors |
| `csv.test.ts` | RFC 4180 quoting plus formula-injection neutralisation |

CI additionally runs `typecheck`, `lint`, `prisma migrate deploy` against a throwaway
`postgres:16-alpine` service, `test`, and a full production `build` — so a schema change that cannot
migrate, or a build-time type error, fails the pull request.

---

## 16. Decisions and trade-offs

| Decision | Why | Accepted cost |
|---|---|---|
| **Stateless signed tokens, no session table** | Multiple instances must verify independently without shared state | No server-side revocation; a reset cannot invalidate live sessions, so the TTL (12 h) is the bound |
| **Single shared passcode, no user accounts** | One owner, no IT support; accounts would add a password-reset problem with no email service | No per-user attribution or audit trail; it is one trust level |
| **Recovery code instead of email reset** | There is no mail service, and a support ticket is not an option for this owner | The code must be stored somewhere off the machine; losing it means deleting the hash row via a database tool |
| **PostgreSQL only, SQLite explicitly rejected** | Several instances share one database | Requires provisioning a real database even for a trivial local run |
| **Real paths instead of a hash router** | Hash URLs are invisible to search engines, and this is a marketing site | A custom client router that must stay in sync with the server's parser — mitigated by sharing one pure module |
| **FR as typed source of truth** | Guarantees both languages are complete at compile time | Every new string requires editing two files |
| **Build-time image manifest** | Files can be replaced with any extension or format without touching code | The manifest must be regenerated after adding a file — automated by `predev`/`prebuild` |
| **Local images plus optional object storage** | The site works with zero third-party accounts; uploads are an upgrade, not a requirement. S3-compatible rather than a bespoke SDK means Supabase Storage, Neon, R2, B2 or S3 all work by changing two environment variables | Two resolution paths to reason about (`resolveImage` makes the precedence explicit), and a public-URL value that is inlined at build time |
| **Bright fallback to built-in content on DB failure** | A stale marketing page beats a 500 | Can silently serve outdated content — hence the `X-Content-Degraded` header and the health-probe signal |
| **Fail-closed login rate limit** | A broken cache must not become an open brute-force window | A rotated Redis token presents as a `429` login lockout, which is counter-intuitive to diagnose |
| **Batch every multi-query read** | A `connection_limit=1` pooler serialises parallel queries and times out under latency | Slightly less flexible composition; more `$transaction` calls |
