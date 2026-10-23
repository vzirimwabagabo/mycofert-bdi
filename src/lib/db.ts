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

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: logLevels,
    // Connection pool sizing matters behind a load balancer: each instance
    // holds its own pool, so N instances × connection_limit must stay under
    // the database's max_connections. Override via DATABASE_CONNECTION_LIMIT.
    ...(process.env.DATABASE_CONNECTION_LIMIT
      ? {
          datasources: {
            db: {
              url: appendParam(process.env.DATABASE_URL ?? '', 'connection_limit', process.env.DATABASE_CONNECTION_LIMIT),
            },
          },
        }
      : {}),
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

/** Append a query parameter to a URL string without disturbing existing ones. */
function appendParam(url: string, key: string, value: string): string {
  if (!url) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}${key}=${value}`
}
