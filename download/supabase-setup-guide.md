# Supabase Setup Guide — MYCOFERT Burundi Website

This guide explains how to move the website database from the local SQLite
file to **Supabase** (free PostgreSQL cloud database). It takes about
15 minutes. No code changes are required — only one line in one file.

---

## Why Supabase?

| Local SQLite (current) | Supabase |
|---|---|
| Database stored in a file on the server | Managed cloud database (backups included) |
| Fine for testing / preview | Production-ready, free tier is enough for this site |
| Data lost if the server is rebuilt | Data survives server restarts and rebuilds |

The project uses **Prisma ORM**, which works with both databases. The schema
(`prisma/schema.prisma`) only uses portable types, so the switch is a
configuration change, not a code change.

---

## Step 1 — Create the Supabase project

1. Go to <https://supabase.com> and sign up (free — GitHub login works).
2. Click **New project**.
3. Choose:
   - **Name:** `mycofert-website`
   - **Database Password:** click *Generate* and **save it somewhere safe**
   - **Region:** closest to Burundi (e.g. `eu-central-1` Frankfurt or `eu-west-2` London)
4. Wait ~2 minutes for provisioning.

## Step 2 — Copy the connection string

1. In the Supabase dashboard open **Project Settings → Database**.
2. Under **Connection string**, choose the **URI** tab.
3. Copy the **Connection pooling** string (port `6543`). It looks like:

   ```
   postgresql://postgres.abcdefghij:YOUR-PASSWORD@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
   ```

4. Replace `[YOUR-PASSWORD]` in it with the password you saved in step 1.

## Step 3 — Point the website at Supabase

Two small edits:

**a) `prisma/schema.prisma`** — switch the datasource provider:

```prisma
datasource db {
  provider = "postgresql"   // was "sqlite"
  url      = env("DATABASE_URL")
}
```

**b) `.env`** — replace the `DATABASE_URL` line:

```
DATABASE_URL="postgresql://postgres.abcdefghij:YOUR-PASSWORD@aws-0-eu-central-1.pooler.supabase.com:6543/postgres"
```

(An `.env.example` file in the project root shows the exact format.)

## Step 4 — Create the tables

From the project folder run:

```bash
bun run db:push
```

This creates the five tables (`Inquiry`, `PageView`, `SiteSetting`,
`Product`, `NewsPost`) in Supabase.

## Step 5 — Start the site

Start (or restart) the website and open any public page once.

On the first request the application **seeds itself**: the six products and
three news articles are copied into the database, and the admin dashboard
opens pre-filled. Nothing to import manually.

## Step 6 — Verify

1. Open the site → everything should render as before.
2. Go to `#/admin`, log in, edit a product name, save.
3. Reload the public page → the change is visible.
4. In Supabase → **Table Editor**, you can see the rows.

---

## Security checklist for production

- [ ] Set a strong `ADMIN_PASSCODE` in `.env` (do not keep `mycofert2026`).
- [ ] Never commit `.env` to git (it is already in `.gitignore`).
- [ ] Keep the Supabase database password secret.
- [ ] In Supabase, leave **Row Level Security** enabled on all tables — the
      website talks to the database through Prisma with a server-side
      connection string, not through the public anon API.

## Optional upgrades (later)

- **Image uploads:** product images currently come from a preset library
  bundled with the site. Supabase **Storage** can be connected later so the
  owner uploads their own photos from the admin dashboard.
- **Automated backups:** enabled on Supabase paid tiers; the free tier keeps
  7 days of backups.
- **Custom domain:** configure in Supabase + your hosting provider.

## Quick reference — where things live

| What | Where |
|---|---|
| Database schema | `prisma/schema.prisma` |
| Connection string | `.env` → `DATABASE_URL` |
| Admin dashboard | website URL → `#/admin` |
| Admin API | `src/app/api/admin/content/route.ts` |
| Public content API | `src/app/api/content/route.ts` |
| Default (seed) content | `src/lib/cms-defaults.ts` |
