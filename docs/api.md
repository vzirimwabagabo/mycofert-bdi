# API reference

Every HTTP endpoint this application exposes. There is no separate API server:
the routes live in `src/app/api/**/route.ts` and are served by the same Next.js
process that renders the pages.

Everything a route returns is JSON. Every route is `dynamic = 'force-dynamic'`
— nothing here is cached at the framework level, because admin data and public
content must reflect the database immediately.

- [Conventions](#conventions)
- [Endpoint summary](#endpoint-summary)
- [Public endpoints](#public-endpoints)
- [Authentication](#authentication)
- [Admin — data](#admin--data)
- [Admin — content](#admin--content)
- [Admin — settings](#admin--settings)
- [Admin — credentials](#admin--credentials)
- [Error handling](#error-handling)

---

## Conventions

### Base URL

Same origin as the site. In development that is `http://localhost:3000`; in
production it is whatever `SITE_URL` is set to (default `https://mycofert.bi`).
There is no version prefix and no CORS configuration — these endpoints are
called only by this application's own browser code.

### Request format

`Content-Type: application/json` for every `POST` and `PATCH`. `DELETE` takes
its arguments in the query string — it has no body.

### Rate-limit headers

Any route that is rate limited returns these headers on the responses listed
under *Returns* below:

| Header | Meaning |
|---|---|
| `RateLimit-Limit` | Requests permitted in the current window |
| `RateLimit-Remaining` | Requests left in the current window |
| `RateLimit-Reset` | Seconds until the window resets |
| `Retry-After` | Seconds to wait — present **only** on a `429` |

The four policies in [src/lib/rate-limit.ts](../src/lib/rate-limit.ts) are:

| Policy | Limit / window | `unknownLimit` | Fails |
|---|---|---|---|
| `LIMIT_ADMIN_AUTH` | 8 per 15 min (60 in development) | none | **closed** |
| `LIMIT_INQUIRIES` | 10 per 10 min | 60 | open |
| `LIMIT_TRACK` | 120 per 5 min | 3000 | open |
| `LIMIT_ADMIN_API` | 300 per 5 min | 1200 | open |

`unknownLimit` applies when the client IP cannot be determined (no trusted
proxy — see `TRUST_PROXY`). Failing *closed* means that if the Redis store is
unreachable, the request is **rejected**. A broken Redis therefore surfaces as
`429` on the login endpoint, which looks nothing like an infrastructure
problem. See [operations.md](operations.md#the-429-that-is-really-redis).

### Cache-Control

Every admin route sets `Cache-Control: no-store`, as does `/api/content`.
`next.config.ts` additionally forces `no-store` on `/api/admin/:path*`.
Health probes set it too.

---

## Endpoint summary

| Method | Path | Auth | Rate limit |
|---|---|---|---|
| `POST` | [`/api/inquiries`](#post-apiinquiries) | none | `LIMIT_INQUIRIES` |
| `POST` | [`/api/track`](#post-apitrack) | none | `LIMIT_TRACK` |
| `GET` | [`/api/content`](#get-apicontent) | none | none |
| `GET` | [`/api/health`](#get-apihealth) | none | none |
| `POST` | [`/api/admin/auth`](#post-apiadminauth) | none (issues a token) | `LIMIT_ADMIN_AUTH` |
| `POST` | [`/api/admin/reset-passcode`](#post-apiadminreset-passcode) | recovery code | `LIMIT_ADMIN_AUTH` |
| `GET` | [`/api/admin/data`](#get-apiadmindata) | token | `LIMIT_ADMIN_API` |
| `PATCH` | [`/api/admin/data`](#patch-apiadmindata) | token | `LIMIT_ADMIN_API` |
| `DELETE` | [`/api/admin/data`](#delete-apiadmindata) | token | `LIMIT_ADMIN_API` |
| `GET` | [`/api/admin/content`](#get-apiadmincontent) | token | `LIMIT_ADMIN_API` |
| `POST` | [`/api/admin/content`](#post-apiadmincontent) | token | `LIMIT_ADMIN_API` |
| `PATCH` | [`/api/admin/content`](#patch-apiadmincontent) | token | `LIMIT_ADMIN_API` |
| `DELETE` | [`/api/admin/content`](#delete-apiadmincontent) | token | `LIMIT_ADMIN_API` |
| `POST` | [`/api/admin/change-passcode`](#post-apiadminchange-passcode) | token | `LIMIT_ADMIN_AUTH` |
| `POST` | [`/api/admin/recovery-code`](#post-apiadminrecovery-code) | token + current passcode | `LIMIT_ADMIN_API` |
| `POST` | [`/api/admin/sign-upload`](#post-apiadminsign-upload) | token | `LIMIT_ADMIN_API` |

---

## Public endpoints

### `POST /api/inquiries`

Submits the contact form. Writes one `Inquiry` row.

Source: [src/app/api/inquiries/route.ts](../src/app/api/inquiries/route.ts)

**Body**

| Field | Type | Required | Rules |
|---|---|---|---|
| `name` | string | yes | Trimmed, control characters stripped, max 200; final value must be ≥ 2 chars |
| `phone` | string | yes | Max 50; must contain ≥ 7 digits |
| `email` | string | no | Max 200; when present must match `/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/` |
| `message` | string | yes | Max 4000; final value must be ≥ 5 chars |
| `type` | string | yes | One of `product`, `bulk`, `fertilizer`, `training`, `partnership` |
| `product` | string | no | Max 120 — the product the visitor was looking at |
| `lang` | string | no | `en` or `fr`; anything else becomes `fr` |
| `website` | string | no | Honeypot. A non-empty value discards the submission |

Control characters (`\u0000`–`\u0008`, `\u000B`, `\u000C`, `\u000E`–`\u001F`,
`\u007F`) are removed from every text field before length checks.

**Returns**

| Status | Body | When |
|---|---|---|
| `201` | `{ "ok": true, "id": "<uuid>" }` | Created. Only the id is echoed — never the stored row |
| `200` | `{ "ok": true, "id": null }` | Honeypot triggered. Deliberately indistinguishable from success so a bot does not retry |
| `400` | `{ "error": "..." }` | `Invalid payload` · `Missing required fields` · `Invalid inquiry type` · `Invalid phone number` · `Invalid email address` · `Submission too short` |
| `429` | `{ "error": "Too many submissions. Please try again later." }` | Rate limited |
| `500` | `{ "error": "Internal server error" }` | Database write failed |

The `201` response does **not** carry rate-limit headers; every other status
does.

**Example**

```bash
curl -X POST http://localhost:3000/api/inquiries \
  -H 'Content-Type: application/json' \
  -d '{"name":"Aline Ndayizeye","phone":"+257 79 123 456","email":"aline@example.bi","type":"product","product":"Oyster mushrooms","message":"I would like a price list for 20 kg per week.","lang":"en"}'
```

---

### `POST /api/track`

Analytics beacon, fired by the client on every navigation.

Source: [src/app/api/track/route.ts](../src/app/api/track/route.ts)

**Always answers `200`.** It runs on every page change, so a non-2xx response
would produce console noise for ordinary visitors. Rate limiting is still
enforced — it just reports `{ "ok": false }` instead of `429`, so the client
never retries.

**Body**

| Field | Type | Rules |
|---|---|---|
| `path` | string | Max 200. Rejected if empty, if it starts with `/undefined` or `/_next`, or if it contains a `.` (asset request) |
| `lang` | string | `en` or `fr`; anything else becomes `fr` |

**Returns**

| Status | Body | When |
|---|---|---|
| `200` | `{ "ok": true }` | Row written |
| `200` | `{ "ok": false }` | Rate limited, rejected path, malformed body, or write failure |

**Privacy.** Only `path` and `lang` are stored. No IP address, no user agent, no
referrer, no cookie. Rows older than `PAGEVIEW_RETENTION_DAYS` (default 365) are
deleted opportunistically, at most once per hour per instance.

---

### `GET /api/content`

Returns the whole public content set — settings, published products, published
news. This is what the pages render from.

Source: [src/app/api/content/route.ts](../src/app/api/content/route.ts)

**No parameters. No auth. No rate limit.**

**Returns**

| Status | Body |
|---|---|
| `200` | `{ products: [...], news: [...], settings: { contact, home, training, about, sustainability } }` |
| `500` | `{ "error": "Internal server error" }` |

**`X-Content-Degraded: 1`** is set when the response is *built-in placeholder
content* rather than stored rows — i.e. the database read failed. The status is
still `200`: a stale-but-plausible page beats a `500` for a visitor. This header
is therefore the only signal an uptime check can see. `/api/health?deep=1`
reports the same state as a JSON field.

**Side effect.** The first ever call seeds an empty database with the default
products, news and settings. Seeding is best-effort and never throws.

---

### `GET /api/health`

Liveness / readiness probe.

Source: [src/app/api/health/route.ts](../src/app/api/health/route.ts)

| Query | Question | Cost |
|---|---|---|
| *(none)* | Is this instance alive? | No dependencies |
| `?deep=1` | Is this instance ready to serve? | One `SELECT 1` against the database |

**Returns — shallow**

```json
{ "status": "ok", "uptime": 812, "timestamp": "2026-10-25T09:14:02.113Z" }
```

**Returns — deep, healthy**

```json
{
  "status": "ok",
  "uptime": 812,
  "timestamp": "2026-10-25T09:14:02.113Z",
  "database": { "status": "ok", "latencyMs": 41 },
  "content": { "degraded": false, "lastFallbackAt": null }
}
```

**Returns — deep, database unreachable**

```json
{
  "status": "degraded",
  "uptime": 812,
  "timestamp": "2026-10-25T09:14:02.113Z",
  "database": { "status": "error" }
}
```

with status **`503`**.

**Load-balancer guidance.** Use the shallow probe for liveness so a database
blip does not restart every instance in a loop; use `?deep=1` for readiness so a
broken instance is taken out of rotation.

`content.degraded` is informational and does **not** affect the status code — a
ready instance should stay in rotation. Alert on it separately to catch "the
site is up but showing the wrong data".

---

## Authentication

### The admin token

A stateless signed token, presented in the `x-admin-token` request header.

```
<base64url(payload)>.<base64url(hmacSha256(payload))>
```

- **Payload**: `{ "sub": "admin", "iss": "mycofert-admin", "iat": <unix>, "exp": <unix> }`
- **TTL**: 12 hours (`TOKEN_TTL_SECONDS`)
- **Algorithm**: HMAC-SHA256 with `ADMIN_SESSION_SECRET` (≥ 32 characters)
- **Storage**: `sessionStorage` under `mycofert-admin-token`. It dies with the
  tab — it is not a persistent cookie and is not sent on page requests.

The signature is verified **before** the payload is parsed, and comparison uses
`timingSafeEqual`.

### `X-Session-Expired: 1`

An `expired` token gets `401` **plus** this header. The dashboard distinguishes
it from a plain `401 Unauthorized` (a forged or absent token): expiry means
"ask for the passcode again", spoofing means "you are not logged in".

Routes that set it: `/api/admin/data`, `/api/admin/content`,
`/api/admin/recovery-code`, `/api/admin/sign-upload`.

> `/api/admin/change-passcode` returns `401 { "error": "Session expired" }`
> **without** the header. Check the message text there, not the header.

### `503` — not configured

`verifyRequest` distinguishes a third case: `ADMIN_SESSION_SECRET` missing or
too short. That is an operator error, not an authentication failure, so it
returns `503 { "error": "Admin authentication is not configured" }`.

---

## Admin — data

Inquiries and analytics. Source:
[src/app/api/admin/data/route.ts](../src/app/api/admin/data/route.ts)

All three methods require the token and are limited by `LIMIT_ADMIN_API`.

### `GET /api/admin/data`

**Query**

| Param | Default | Max | Notes |
|---|---|---|---|
| `page` | `1` | `10000` | |
| `pageSize` | `50` | `200` | |
| `status` | *(all)* | — | `new` or `handled`; any other value means no filter |

**Returns `200`**

```json
{
  "inquiries": [ { "id": "...", "name": "...", "status": "new", "...": "..." } ],
  "pagination": { "page": 1, "pageSize": 50, "total": 137, "totalPages": 3 },
  "stats": {
    "total": 137,
    "filtered": 137,
    "newCount": 12,
    "pageviews": 4820,
    "byType": { "product": 61, "bulk": 30 },
    "topPages": [ { "path": "/fr/produits", "count": 900 } ]
  }
}
```

`stats.total` is the unfiltered count — it stays the same while you page
through. `stats.filtered` is the count matching `status`. `topPages` is capped
at 8 entries.

**Implementation note.** All five reads run inside one `db.$transaction([...])`.
The pool holds a single connection, so five separate queries would queue behind
one another and each pay a full network round trip — that is how a remote
database turns into `P2024`. Batching costs one round trip. The "new" badge and
the pageview total are derived from the `groupBy` results rather than queried
separately.

**Returns**

| Status | Body | When |
|---|---|---|
| `200` | As above | |
| `401` | `{ "error": "Unauthorized" }` or `Session expired` | Bad/missing or expired token |
| `429` | `{ "error": "Too many requests" }` | Rate limited |
| `503` | `{ "error": "The database is temporarily unavailable. Please retry.", "code": "DB_UNAVAILABLE" }` | Transient database failure |

The `503` carries `Retry-After: 5` and `X-Db-Unavailable: 1`.

### `PATCH /api/admin/data`

Marks an inquiry as handled, or reopens it.

**Body**

```json
{ "id": "<uuid>", "status": "handled" }
```

`status` must be exactly `handled` or `new`.

**Returns**

| Status | Body |
|---|---|
| `200` | `{ "ok": true, "inquiry": { ... } }` |
| `400` | `{ "error": "Invalid payload" }` |
| `404` | `{ "error": "Inquiry not found" }` |

### `DELETE /api/admin/data?id=<uuid>`

Deletes an inquiry permanently. Logs the client IP and inquiry id.

**Returns**

| Status | Body |
|---|---|
| `200` | `{ "ok": true }` |
| `400` | `{ "error": "Missing id" }` |
| `404` | `{ "error": "Inquiry not found" }` |

---

## Admin — content

Products and news. Source:
[src/app/api/admin/content/route.ts](../src/app/api/admin/content/route.ts)

All four methods require the token and are limited by `LIMIT_ADMIN_API`.

### `GET /api/admin/content`

Returns everything the dashboard needs to render its editors — including
unpublished rows, which the public endpoint hides.

**Returns `200`** — `{ products: [...], news: [...], settings: { ... } }` — with
`Cache-Control: no-store`. A transient database failure returns the same
`503` / `Retry-After: 5` / `X-Db-Unavailable: 1` shape as `/api/admin/data`.

### `POST /api/admin/content`

Creates a product or a news post.

**Body**

```json
{ "kind": "product", "data": { "nameFr": "...", "nameEn": "...", "...": "..." } }
{ "kind": "news",    "data": { "titleFr": "...", "...": "..." } }
```

`kind` must be `product` or `news`; anything else is `400 Invalid kind`.

**Required** — `product`: `nameFr`. `news`: `titleFr`. The `Fr` column is
mandatory and the matching `En` value falls back to it when omitted, so a
partially translated record never renders an empty string.

**Slug** — taken from `data.slug` if present, otherwise derived from the French
name/title. A slug that reduces to nothing is `400 Invalid slug`.

**Field limits** (enforced by truncation, not rejection):

| Product | Max | | News | Max |
|---|---|---|---|---|
| `slug` | 60 | | `slug` | 60 |
| `nameFr` / `nameEn` | 200 | | `titleFr` / `titleEn` | 200 |
| `taglineFr` / `taglineEn` | 300 | | `dateFr` / `dateEn` | 60 |
| `descFr` / `descEn` | 5000 | | `excerptFr` / `excerptEn` | 1000 |
| `pointsFr` / `pointsEn` | 5000 | | `bodyFr` / `bodyEn` | 40000 |
| `formatsFr` / `formatsEn` | 500 | | `imageUrl` | 1000 |
| `imageKey` | 40 | | `imageKey` | 40 |

**`imageKey`** must be one of the nine library keys (`fresh`, `dried`,
`powder`, `packaged`, `substrate`, `fertilizer`, `sustainability`, `training`,
`hero`). An unrecognised value is replaced by a default (`fresh` for products,
`training` for news) rather than stored — a bogus key would silently render as
the fallback anyway.

**`imageUrl`** must be `https://` and start with one of the allowed origins — the
object-storage public base (`NEXT_PUBLIC_STORAGE_PUBLIC_URL`, when configured)
or the legacy `https://res.cloudinary.com/` — and be at most 1000 characters.
Anything else is `400 Invalid image URL`. This is the same allow-list the CSP
`img-src` uses, so a stored URL can never point at an arbitrary host. Send
`null` or `""` to clear it.

The origin is matched with its trailing slash, so
`https://res.cloudinary.com.example.org/x.png` is rejected rather than being
accepted as a prefix of the Cloudinary host.

**`published`** defaults to `true` — only an explicit `false` unpublishes.
**`sortOrder`** defaults to `0`.

**Returns**

| Status | Body | When |
|---|---|---|
| `200` | `{ "ok": true, "product": { ... } }` or `{ "ok": true, "news": { ... } }` | Created |
| `400` | `Product name (FR) is required` · `Article title (FR) is required` · `Invalid slug` · `Invalid image URL` · `Invalid kind` | |
| `409` | `{ "error": "duplicate-slug" }` | Slug already used |

### `PATCH /api/admin/content`

Updates an existing product, news post, or site setting. Partial: only the
fields present in `data` are written.

**Body — item**

```json
{ "kind": "product", "id": "<uuid>", "data": { "nameFr": "New name" } }
{ "kind": "news",    "id": "<uuid>", "data": { "published": false } }
```

**Body — setting**

```json
{ "kind": "setting", "key": "home", "value": { "heroImage": "https://<storage-host>/mycofert/2026/10/<uuid>.webp" } }
```

`key` must be one of `contact`, `home`, `training`, `about`, `sustainability`
(see `SETTING_KEYS`); `value` must be a non-array object. The setting is
upserted as a JSON string.

`settings.home.heroImage` is rendered as an `<img src>` on every page load, so
it is held to the same origin allow-list; any other value is
`400 Invalid hero image URL`.

**Renaming.** When `nameFr` (or `titleFr`) is updated, `nameEn`/`titleEn` is set
to the supplied English value or falls back to the French one — the pair is
never left half-empty.

**`imageUrl` semantics** — `undefined` (field absent) leaves the stored value
untouched; `null` or `""` clears it; anything else must pass the origin
allow-list check.

**Returns**

| Status | Body | When |
|---|---|---|
| `200` | `{ "ok": true }` | Updated |
| `400` | `Missing id` · `Invalid image URL` · `Invalid setting payload` · `Invalid hero image URL` · `Invalid kind` | |
| `404` | `{ "error": "Not found" }` | No row with that id |
| `409` | `{ "error": "duplicate-slug" }` | New slug collides |

### `DELETE /api/admin/content?kind=<product|news>&id=<uuid>`

Deletes a product or news post **permanently**. There is no soft-delete and no
undo. Settings cannot be deleted, only overwritten.

**Returns**

| Status | Body |
|---|---|
| `200` | `{ "ok": true }` |
| `400` | `{ "error": "Invalid payload" }` |
| `404` | `{ "error": "Not found" }` |

---

## Admin — credentials

### `POST /api/admin/auth`

Exchanges the passcode for a session token. The only unauthenticated admin
route that grants access.

Source: [src/app/api/admin/auth/route.ts](../src/app/api/admin/auth/route.ts)

**Body** — `{ "passcode": "..." }`

**Returns**

| Status | Body | When |
|---|---|---|
| `200` | `{ "token": "<payload>.<signature>", "expiresAt": <unix ms> }` | Correct passcode |
| `400` | `{ "error": "The configured admin passcode is too weak (minimum 12 characters)." }` | Operator misconfiguration |
| `401` | `{ "error": "Invalid credentials" }` | Wrong passcode |
| `429` | `{ "error": "Too many attempts. Try again later." }` | Rate limited |
| `503` | `{ "error": "Admin authentication is not configured on this server." }` | `ADMIN_SESSION_SECRET` missing/short |

Two precedence rules matter here:

1. **`admin_passcode_hash` wins over `ADMIN_PASSCODE`.** Once the passcode has
   been changed from the dashboard, editing `.env` has no effect — the stored
   hash is consulted first.
2. **Rate limiting runs before any work**, so brute force costs the attacker
   even when the passcode is wrong. `LIMIT_ADMIN_AUTH` fails **closed**: if the
   Redis store is down, logins are refused with `429` rather than allowed.

### `POST /api/admin/change-passcode`

Changes the passcode. Requires a token **and** the current passcode.

Source: [src/app/api/admin/change-passcode/route.ts](../src/app/api/admin/change-passcode/route.ts)

**Body** — `{ "currentPasscode": "...", "newPasscode": "..." }`

**Returns**

| Status | Body | When |
|---|---|---|
| `200` | `{ "ok": true, "message": "Passcode updated successfully" }` | |
| `400` | `Missing required fields` · `Current passcode is incorrect` · `New passcode must be at least 12 characters` | |
| `401` | `{ "error": "Unauthorized" }` or `"Session expired"` — **no** `X-Session-Expired` header | Bad/expired token |
| `429` | `{ "error": "Too many attempts. Try again later." }` | Rate limited — `LIMIT_ADMIN_AUTH`, not the admin-API policy |
| `503` | `{ "error": "Authentication not configured" }` | `ADMIN_SESSION_SECRET` missing |

The new passcode is written to the database as a scrypt hash (16-byte salt,
64-byte key) and takes effect immediately, overriding `ADMIN_PASSCODE`.

### `POST /api/admin/recovery-code`

Generates — or replaces — the recovery code. **Single-use; issuing a new one
invalidates the previous one.**

Source: [src/app/api/admin/recovery-code/route.ts](../src/app/api/admin/recovery-code/route.ts)

Requires a token **and** the current passcode: a stolen session token alone must
not be enough to mint a credential that outlives the session and survives a
later passcode change.

**Body** — `{ "passcode": "<current passcode>" }`

**Returns**

| Status | Body | When |
|---|---|---|
| `200` | `{ "recoveryCode": "XXXX-XXXX-XXXX-XXXX" }` | Generated. `Cache-Control: no-store` |
| `400` | `{ "error": "Current passcode is incorrect" }` | |
| `401` | `Unauthorized` / `Session expired` + `X-Session-Expired: 1` | Bad/expired token |
| `429` | `{ "error": "Too many requests" }` | `LIMIT_ADMIN_API` |
| `500` | `{ "error": "Internal server error" }` | |

The code is 80 bits of entropy over the 32-symbol alphabet
`23456789ABCDEFGHJKLMNPQRSTUVWXYZ` (no `0`/`O`/`1`/`I`). The plaintext is
returned exactly once, here; only its scrypt hash is stored, in
`admin_recovery_hash`. If it is lost, generate a new one.

### `POST /api/admin/reset-passcode`

The "I forgot the passcode" path. **Unauthenticated by definition** — whoever
needs it cannot sign in — which makes it the most sensitive route in the app.

Source: [src/app/api/admin/reset-passcode/route.ts](../src/app/api/admin/reset-passcode/route.ts)

**Body** — `{ "recoveryCode": "XXXX-XXXX-XXXX-XXXX", "newPasscode": "..." }`

**Returns**

| Status | Body | When |
|---|---|---|
| `200` | `{ "ok": true, "recoveryCode": "<new code>" }` | Reset succeeded. `Cache-Control: no-store` |
| `400` | `Missing required fields` | |
| `400` | `Invalid recovery code` | Code wrong, already used, or none exists |
| `400` | `No recovery code has been set up for this dashboard. Whoever hosts the site can reset the passcode from the server.` | Fail-safe guidance, deliberately actionable |
| `400` | `New passcode must be at least 12 characters` | |
| `429` | `{ "error": "Too many attempts. Try again later." }` | `LIMIT_ADMIN_AUTH` |
| `503` | `{ "error": "Admin authentication is not configured on this server." }` | |

Design notes:

- The used code is **consumed**, and a replacement is returned in the same
  response — the owner must not be left without a way back in.
- It does **not** issue a session token. The owner signs in normally afterwards,
  so this endpoint cannot be turned into a login bypass.
- Nothing is revealed about *why* a code was rejected.
- Both credential rows are written in a single `db.$transaction`, so the
  passcode and the recovery code can never disagree.

### `POST /api/admin/sign-upload`

Mints a one-shot upload credential. The browser then sends the file **directly
to the provider** — image bytes never transit this server.

Source: [src/app/api/admin/sign-upload/route.ts](../src/app/api/admin/sign-upload/route.ts)

**Body**

```json
{ "contentType": "image/webp", "size": 182944 }
```

`contentType` must be one of `image/jpeg`, `image/png`, `image/webp`,
`image/avif`, `image/gif` (SVG is deliberately excluded — it is a document that
can carry script, and objects are served from a public bucket at a stable URL).
`size` is the exact byte length, capped at 5 MB.

Both values are needed **only for the object-storage provider**: they are part
of the presigned signature, which is what makes the type and size limits real
rather than advisory — the bucket answers a mismatch with
`403 SignatureDoesNotMatch`. The Cloudinary fallback ignores the body.

**Provider selection** — object storage wins whenever `STORAGE_*` is complete,
so an existing Cloudinary deployment keeps working until the bucket is set up,
then switches over without a code change. The response `provider` field says
which one was used; the client must not assume.

**Returns**

| Status | Body | When |
|---|---|---|
| `200` | `{ provider: "storage", uploadUrl, publicUrl, contentType }` | Object storage. `uploadUrl` is a presigned `PUT` valid for 5 minutes; the browser must send exactly the `Content-Type` and body length that were signed. `Cache-Control: no-store` |
| `200` | `{ provider: "cloudinary", signature, timestamp, apiKey, cloudName, folder }` | Cloudinary fallback: POST the file to `https://api.cloudinary.com/v1_1/{cloudName}/image/upload` and store the returned `secure_url`. `Cache-Control: no-store` |
| `400` | `contentType and size are required` · `Invalid file size` | Storage provider, body malformed |
| `400` | `Unsupported image type. Use JPEG, PNG, WebP, AVIF or GIF.` | Storage provider, type not allowed |
| `401` | `Unauthorized` / `Session expired` + `X-Session-Expired: 1` | Bad/expired token |
| `413` | `Image must be under 5 MB` | Storage provider, `size` over the cap |
| `429` | `{ "error": "Too many requests" }` | `LIMIT_ADMIN_API` |
| `500` | `{ "error": "Internal server error" }` | Signature could not be built |
| `503` | `Image uploads are not configured on this server (missing object storage or Cloudinary credentials).` | Neither provider configured |
| `503` | `Image storage is not configured` | Storage was configured at the check but vanished before signing (defensive; should be unreachable) |

Objects are written under `mycofert/<yyyy>/<mm>/<uuid>.<ext>` — the uploaded
filename is never used, because it is attacker-controlled text that would
otherwise leak into the object path (`../`, control characters, a `.html`
extension). Cloudinary uploads use the folder `mycofert`, with the signature
being SHA-1 of `folder=<folder>&timestamp=<ts>` + the API secret.

Three failures to recognise and their causes:

- `403` **from the bucket** means the signature did not match — almost always a
  client that sent a different `Content-Type` or a body other than the size it
  declared.
- A cross-origin `PUT` that fails at the transport level is nearly always a
  **missing CORS rule** on the bucket for `PUT` from the site origin. The
  dashboard surfaces this with a dedicated message.
- A `401` from **Cloudinary** (not from this route) almost always means
  `CLOUDINARY_CLOUD_NAME` holds the upload-preset name instead of the account
  cloud name.

---

## Error handling

### The `503` database contract

Admin routes distinguish "the database hiccuped" from "you are not allowed in".
A transient Prisma failure — `P1001`, `P1002`, `P1008`, `P1017`, `P2024`,
`ECONNRESET`, `ETIMEDOUT`, `ECONNREFUSED`, `EPIPE`, `ENOTFOUND` — returns:

```
HTTP/1.1 503 Service Unavailable
Retry-After: 5
X-Db-Unavailable: 1

{ "error": "The database is temporarily unavailable. Please retry.", "code": "DB_UNAVAILABLE" }
```

The dashboard must retry on this and must **not** log the user out — that is
what `X-Session-Expired` / `401` is for.

### Status code reference

| Status | Meaning in this API |
|---|---|
| `200` | Success |
| `201` | Inquiry created |
| `400` | Bad input, or an operator misconfiguration the caller can act on |
| `401` | Missing, forged, or expired admin token |
| `404` | No row with that id |
| `409` | Slug collision |
| `429` | Rate limited — read `Retry-After` |
| `500` | A bug, or a non-transient database error |
| `503` | Database temporarily unavailable, or a required integration is not configured |

### What is never logged

- Passcodes, hashes and recovery codes are never written to logs.
- Inquiry bodies are not logged.
- Page views store no IP address and no user agent.
- Prisma query logging is disabled in production (`logLevels` in
  [src/lib/db.ts](../src/lib/db.ts)) precisely because query parameters contain
  visitor PII.

Logs that *do* get written, and are worth alerting on:

```
[api/admin/reset-passcode] admin passcode was reset using a recovery code
[cms-server] ... SERVING PLACEHOLDER CONTENT ...
[api/track] pruned N page views older than Nd
```
