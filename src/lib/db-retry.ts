// Transient-failure handling for database access.
//
// The database is remote, so "the connection hiccuped" is a routine event and
// not a bug: a cold start after idle, a dropped Wi-Fi interface or a VPN switch
// all surface as one of the codes below. Distinguishing those from real errors
// lets callers retry them (instead of failing) and report them honestly — a
// stall used to reach the dashboard as a bare 500 with no explanation.
//
// Deliberately free of any Prisma import so it can be unit-tested without
// constructing a client or touching a database.

const TRANSIENT_CODES = new Set([
  'P1001', // can't reach the database server
  'P1002', // the database server timed out
  'P1008', // operation timed out
  'P1017', // server has closed the connection
  'P2024', // timed out fetching a connection from the pool
  'ECONNRESET',
  'ETIMEDOUT',
  'ECONNREFUSED',
  'EPIPE',
  'ENOTFOUND',
])

const TRANSIENT_MESSAGE =
  /timed out fetching a new connection|can't reach database server|server has closed the connection|connection reset|socket hang up/i

/** Whether a failure looks like a temporary connection/pool problem. */
export function isTransientDbError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const code = (error as { code?: unknown }).code
  if (typeof code === 'string' && TRANSIENT_CODES.has(code)) return true
  return error instanceof Error && TRANSIENT_MESSAGE.test(error.message)
}

const DB_RETRY_ATTEMPTS = 2
const DB_RETRY_DELAY_MS = 500

/**
 * Run a database operation, retrying once if it fails for a transient
 * connection reason and not retrying at all if it fails for a real one.
 *
 * Reads only — or a batch wrapped in $transaction(), which is atomic. Never
 * pass a bare write here: a retry could apply it twice.
 */
export async function withDbRetry<T>(operation: () => Promise<T>, label: string): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= DB_RETRY_ATTEMPTS; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      if (!isTransientDbError(error) || attempt === DB_RETRY_ATTEMPTS) break
      console.warn(
        `[db] ${label}: transient failure on attempt ${attempt}/${DB_RETRY_ATTEMPTS}, retrying in ${DB_RETRY_DELAY_MS}ms`
      )
      await new Promise((resolve) => setTimeout(resolve, DB_RETRY_DELAY_MS))
    }
  }
  throw lastError
}
