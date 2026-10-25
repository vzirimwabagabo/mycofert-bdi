import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Query logging writes every statement — including inquiry contents (customer
// names, phone numbers, messages) — into the container log. That is a PII
// leak in production, so logs are limited to errors there.
const logLevels: ('query' | 'warn' | 'error')[] =
  process.env.NODE_ENV === 'production'
    ? ['error']
    : ['warn', 'error']

// DATABASE_URL already carries connection_limit=1 for PgBouncer / Neon pooler.
// DATABASE_CONNECTION_LIMIT is only used for direct (non-pooler) connections
// where the URL does not already include a limit.
const databaseUrl = process.env.DATABASE_URL ?? '';
const isPoolerUrl = databaseUrl.includes('pgbouncer=true') || databaseUrl.includes('connection_limit=');

function buildUrl(): string {
  if (!databaseUrl) return databaseUrl;
  if (isPoolerUrl) return databaseUrl; // limit already encoded in URL
  const limit = process.env.DATABASE_CONNECTION_LIMIT;
  return limit ? appendParam(databaseUrl, 'connection_limit', limit) : databaseUrl;
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: logLevels,
    datasources: { db: { url: buildUrl() } },
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

/** Append a query parameter to a URL string without disturbing existing ones. */
function appendParam(url: string, key: string, value: string): string {
  if (!url) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}${key}=${value}`
}
