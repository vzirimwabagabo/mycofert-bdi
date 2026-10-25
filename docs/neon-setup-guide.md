# Neon PostgreSQL Setup Guide

MYCOFERT uses Neon serverless PostgreSQL for production data persistence.

## Why Neon?
- Native PostgreSQL 16 engine.
- Generous Free Tier: 0.5 GB storage, autoscaling compute.
- Built-in connection pooler (`-pooler`) for serverless/load-balanced Next.js instances.
- Zero cold-start crashes: the app contains built-in graceful fallback to static defaults if the database is waking up.
- Automatic point-in-time recovery and database branching.

---

## 1. Environment Variables

In your deployment secrets or local `.env`:

```env
# Pooled connection string (used by Next.js and Prisma Client at runtime):
DATABASE_URL="postgresql://neondb_owner:[PASSWORD]@[ENDPOINT]-pooler.[REGION].aws.neon.tech/neondb?sslmode=require&channel_binding=require"

# Direct unpooled connection string (used by Prisma migrate deploy):
DIRECT_URL="postgresql://neondb_owner:[PASSWORD]@[ENDPOINT].[REGION].aws.neon.tech/neondb?sslmode=require&channel_binding=require"
```

> **Note**: To obtain the `DIRECT_URL`, simply take your pooled connection string and remove `-pooler` from the endpoint hostname.

---

## 2. Deploying Migrations

To apply pending migrations to your Neon database:

```bash
npm run db:deploy
```

To seed initial CMS settings and defaults:

```bash
npm run db:seed
```

---

## 3. Database Maintenance & Inspection

Open Prisma Studio to inspect and edit rows in a local visual GUI:

```bash
npm run db:studio
```
