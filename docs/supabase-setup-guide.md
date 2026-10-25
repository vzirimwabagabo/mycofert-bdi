# Supabase PostgreSQL Setup Guide

MYCOFERT uses Supabase free-tier PostgreSQL as its production database.

## Why Supabase?
- Fully managed PostgreSQL (same engine used locally via Docker)  
- Free tier: 2 projects, 500 MB storage, 2 GB bandwidth/month  
- Built-in connection pooler (PgBouncer) — critical for serverless/edge  
- Automatic backups, dashboard, row-level security

## 1. Create a Project

1. Go to https://supabase.com and sign in (or create an account).
2. Click **New Project**, choose a name (e.g. `mycofert-prod`), set a strong DB password.
3. Wait for provisioning (~2 minutes).

## 2. Get the Connection String

In your project dashboard:

1. Go to **Settings → Database → Connection Pooling**.
2. Select **Mode: Transaction** (required for serverless multi-instance deploys).
3. Copy the **Connection string** — it looks like:
   ```
   postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
   ```
4. Append `?pgbouncer=true&connection_limit=1` to the URL for Prisma compatibility.

## 3. Set the Environment Variable

Add to your production secrets:
```
DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
```

## 4. Apply Migrations

```bash
# From the project root, with DATABASE_URL pointing at Supabase:
npm run db:deploy
```

This runs `prisma migrate deploy` which applies all migrations in `prisma/migrations/`.

## 5. Seed Initial Data (optional)

```bash
npm run db:seed
```

## 6. Local Development

Use the Docker Compose local Postgres (no Supabase account needed):

```bash
docker compose up -d     # start local Postgres
cp .env.example .env     # copy the template
# Edit .env — the default DATABASE_URL already points to localhost:5432
npm run db:migrate       # apply and create migrations locally
```

## Security Notes

- The database password is a production secret — never commit it.
- The Supabase project has its own row-level security; the app also validates  
  every write through Prisma and the admin auth token.
- Rotate the DB password via Supabase Dashboard → Settings → Database if compromised.
