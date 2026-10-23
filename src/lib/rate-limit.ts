// Shared rate limiting.
//
// The load balancer sends traffic to N app instances, so a per-process counter
// is wrong: each instance would allow the full quota and an attacker gets
// N × limit attempts. The default strategy is therefore backed by shared
// state (Redis). When REDIS_URL is absent — local development, or a
// single-instance deploy — it falls back to an in-process store and logs a
// warning in production, because the fallback is NOT correct behind a LB.

import { NextRequest } from 'next/server';

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Unix ms at which the window resets. */
  resetAt: number;
  /** Seconds the client should wait before retrying (only when blocked). */
  retryAfter: number;
}

export interface RateLimitOptions {
  /** Bucket name — keeps separate endpoints' counters from colliding. */
  key: string;
  limit: number;
  windowSeconds: number;
}

// ---------------------------------------------------------------------------
// Stores
// ---------------------------------------------------------------------------

interface Store {
  readonly kind: 'redis' | 'memory' | 'noop';
  hit(key: string, windowSeconds: number): Promise<number>;
  ttl(key: string): Promise<number>;
}

/** In-process fixed-window counter. Correct only for a single instance. */
class MemoryStore implements Store {
  readonly kind = 'memory' as const;
  private buckets = new Map<string, { count: number; resetAt: number }>();
  private lastSweep = 0;

  async hit(key: string, windowSeconds: number): Promise<number> {
    const now = Date.now();
    // Opportunistic sweep so long-running processes do not leak memory.
    if (now - this.lastSweep > 60_000) {
      for (const [k, v] of this.buckets) if (v.resetAt <= now) this.buckets.delete(k);
      this.lastSweep = now;
    }
    const existing = this.buckets.get(key);
    if (!existing || existing.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
      return 1;
    }
    existing.count += 1;
    return existing.count;
  }

  async ttl(key: string): Promise<number> {
    const b = this.buckets.get(key);
    return b ? Math.max(0, Math.ceil((b.resetAt - Date.now()) / 1000)) : 0;
  }
}

/**
 * Redis fixed-window counter using the REST API (Upstash-compatible), so no
 * extra npm dependency is required. Works with any Redis that exposes the
 * HTTP command endpoint, e.g. Upstash or self-hosted with a proxy.
 */
class RedisStore implements Store {
  readonly kind = 'redis' as const;
  constructor(
    private url: string,
    private token: string
  ) {}

  private async command(args: (string | number)[]): Promise<unknown> {
    const res = await fetch(this.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args),
      // Never let a slow cache turn into an outage of the endpoint.
      signal: AbortSignal.timeout(1500),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`redis ${res.status}`);
    return (await res.json()) as unknown;
  }

  async hit(key: string, windowSeconds: number): Promise<number> {
    const count = await this.command(['INCR', key]);
    const n = typeof count === 'number' ? count : Number(count);
    if (!Number.isFinite(n)) throw new Error('redis: bad INCR result');
    // Set the TTL only on the first hit, so the window does not slide.
    if (n === 1) await this.command(['EXPIRE', key, windowSeconds]);
    return n;
  }

  async ttl(key: string): Promise<number> {
    const t = await this.command(['TTL', key]);
    const n = typeof t === 'number' ? t : Number(t);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }
}

/** Used when rate limiting cannot be enforced; fails open but logs loudly. */
class NoopStore implements Store {
  readonly kind = 'noop' as const;
  async hit(): Promise<number> {
    return 1;
  }
  async ttl(): Promise<number> {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Store selection
// ---------------------------------------------------------------------------

let cachedStore: Store | null = null;

function getStore(): Store {
  if (cachedStore) return cachedStore;

  const url = process.env.RATE_LIMIT_REDIS_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.RATE_LIMIT_REDIS_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    cachedStore = new RedisStore(url.replace(/\/+$/, ''), token);
    return cachedStore;
  }

  if (process.env.NODE_ENV === 'production') {
    // Behind a load balancer this is a real weakness, so make it unmissable.
    console.warn(
      '[rate-limit] No RATE_LIMIT_REDIS_URL/TOKEN set — falling back to per-instance ' +
        'in-memory counters. This is NOT effective across multiple instances. ' +
        'Set Redis before scaling out.'
    );
  }

  cachedStore = process.env.NODE_ENV === 'production' ? new MemoryStore() : new MemoryStore();
  return cachedStore;
}

// ---------------------------------------------------------------------------
// Client identity
// ---------------------------------------------------------------------------

/**
 * Resolve the client IP.
 *
 * Trusting X-Forwarded-For blindly lets a client spoof its own identity and
 * bypass rate limits, so we only read it when TRUST_PROXY=1 (i.e. we know a
 * load balancer we control sits in front and overwrites the header). The
 * left-most entry is used, which is the convention for the original client.
 */
export function getClientIp(req: NextRequest): string {
  const trustProxy = process.env.TRUST_PROXY === '1';

  if (trustProxy) {
    const xff = req.headers.get('x-forwarded-for');
    if (xff) {
      const first = xff.split(',')[0]?.trim();
      if (first) return first;
    }
    const realIp = req.headers.get('x-real-ip');
    if (realIp) return realIp.trim();
  }

  // Next.js does not expose the socket address on NextRequest in all runtimes;
  // when unavailable we fall back to a constant bucket. That is deliberately
  // conservative: it rate-limits globally rather than allowing anonymous
  // clients to evade the limit, and TRUST_PROXY should be set in production.
  return 'unknown';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

function bucketKey(opts: RateLimitOptions, identity: string): string {
  const window = Math.floor(Date.now() / (opts.windowSeconds * 1000));
  return `rl:${opts.key}:${identity}:${window}`;
}

/**
 * Consume one unit from the bucket for `identity`.
 * Fails open if the shared store is unreachable — availability of the public
 * site is preferred over strict limiting — but logs the failure.
 */
export async function rateLimit(
  opts: RateLimitOptions,
  identity: string
): Promise<RateLimitResult> {
  const store = getStore();
  const key = bucketKey(opts, identity);

  try {
    const count = await store.hit(key, opts.windowSeconds);
    const ttl = await store.ttl(key);
    const remaining = Math.max(0, opts.limit - count);
    return {
      allowed: count <= opts.limit,
      limit: opts.limit,
      remaining,
      resetAt: Date.now() + ttl * 1000,
      retryAfter: count > opts.limit ? Math.max(1, ttl) : 0,
    };
  } catch (error) {
    console.error('[rate-limit] store failure, failing open:', error);
    const noop = new NoopStore();
    void noop;
    return { allowed: true, limit: opts.limit, remaining: opts.limit, resetAt: Date.now(), retryAfter: 0 };
  }
}

/** Convenience: rate limit a request by its client IP. */
export function rateLimitRequest(
  req: NextRequest,
  opts: RateLimitOptions
): Promise<RateLimitResult> {
  return rateLimit(opts, getClientIp(req));
}

/** Standard rate-limit response headers. */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'RateLimit-Limit': String(result.limit),
    'RateLimit-Remaining': String(result.remaining),
    'RateLimit-Reset': String(Math.max(0, Math.ceil((result.resetAt - Date.now()) / 1000))),
  };
  if (!result.allowed) headers['Retry-After'] = String(result.retryAfter);
  return headers;
}

// ---------------------------------------------------------------------------
// Named policies
// ---------------------------------------------------------------------------

/** Login attempts: tight, because a passcode is the only factor. */
export const LIMIT_ADMIN_AUTH: RateLimitOptions = {
  key: 'admin-auth',
  limit: 8,
  windowSeconds: 15 * 60,
};

/** Public inquiry submissions: generous for humans, hostile to scripts. */
export const LIMIT_INQUIRIES: RateLimitOptions = {
  key: 'inquiries',
  limit: 10,
  windowSeconds: 10 * 60,
};

/** Analytics beacon: pages are cheap, but a loop must not grow the table. */
export const LIMIT_TRACK: RateLimitOptions = {
  key: 'track',
  limit: 120,
  windowSeconds: 5 * 60,
};

/** Authenticated admin reads. */
export const LIMIT_ADMIN_API: RateLimitOptions = {
  key: 'admin-api',
  limit: 300,
  windowSeconds: 5 * 60,
};
