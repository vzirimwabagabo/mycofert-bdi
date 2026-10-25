// Shared rate limiting.
//
// The load balancer sends traffic to N app instances, so a per-process counter
// is wrong: each instance would allow the full quota and an attacker gets
// N × limit attempts. The default strategy is therefore backed by shared
// state (Redis). When REDIS_URL is absent — local development, or a
// single-instance deploy — it falls back to an in-process store and logs a
// warning in production, because the fallback is NOT correct behind a LB.
//
// Failure semantics are per-policy:
//   * Public endpoints (inquiries, track) fail OPEN on a store outage — the
//     marketing site staying up matters more than perfect limits.
//   * The admin login endpoint fails CLOSED — an outage must not silently
//     re-enable unlimited passcode brute force.

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
  /**
   * Cap used when the client IP is unknown (no trusted proxy configured).
   * Without this, all anonymous visitors share ONE bucket; a limit tuned for
   * a single abusive client would then throttle the entire site.
   */
  unknownLimit?: number;
  /**
   * Fail CLOSED when the shared store errors. Use for security-critical
   * endpoints (admin login) where availability is less important than
   * keeping the brute-force bound.
   */
  failClosed?: boolean;
}

// ---------------------------------------------------------------------------
// Stores
// ---------------------------------------------------------------------------

interface Store {
  readonly kind: 'redis' | 'memory';
  /** Increment the counter for this bucket; returns the new count. */
  hit(key: string, windowSeconds: number): Promise<number>;
}

/**
 * Fixed-window counter. The reset time is derived from the key's window
 * index, so no TTL round-trip is needed and the window never slides.
 */
class MemoryStore implements Store {
  readonly kind = 'memory' as const;
  private buckets = new Map<string, { count: number; window: number }>();
  private lastSweep = 0;

  async hit(key: string, windowSeconds: number): Promise<number> {
    const now = Date.now();
    // Opportunistic sweep so long-running processes do not leak memory.
    if (now - this.lastSweep > 60_000) {
      const currentWindow = Math.floor(now / (windowSeconds * 1000));
      for (const [k, v] of this.buckets) if (v.window < currentWindow) this.buckets.delete(k);
      this.lastSweep = now;
    }
    // The sweep above uses the *current call's* window length, which can
    // leave stale entries of other durations behind; check per-key too.
    const windowIndex = Math.floor(now / (windowSeconds * 1000));
    const existing = this.buckets.get(key);
    if (!existing || existing.window !== windowIndex) {
      this.buckets.set(key, { count: 1, window: windowIndex });
      return 1;
    }
    existing.count += 1;
    return existing.count;
  }
}

/**
 * Redis fixed-window counter using the REST API (Upstash-compatible), so no
 * extra npm dependency is required. INCR and EXPIRE are sent as one pipeline
 * (EXPIRE with the NX flag applies the TTL only on first increment), which
 * is both atomic-enough and a single round trip.
 */
class RedisStore implements Store {
  readonly kind = 'redis' as const;
  constructor(
    private url: string,
    private token: string
  ) {}

  /** Run a pipeline of commands; returns one result per command. */
  private async pipeline(commands: (string | number)[][]): Promise<unknown[]> {
    const endpoint = this.url.endsWith('/pipeline') ? this.url : `${this.url}/pipeline`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(commands),
      // Never let a slow cache turn into an outage of the endpoint.
      signal: AbortSignal.timeout(1500),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`redis ${res.status}`);
    const body = (await res.json()) as unknown;
    if (!Array.isArray(body)) throw new Error('redis: non-pipeline response');
    return body;
  }

  async hit(key: string, windowSeconds: number): Promise<number> {
    const results = await this.pipeline([
      ['INCR', key],
      // "NX": only set TTL if none exists, so the window does not slide.
      ['EXPIRE', key, windowSeconds, 'NX'],
    ]);
    const first = results[0];
    const count =
      first && typeof first === 'object' && 'result' in first
        ? (first as { result: unknown }).result
        : first;
    const n = typeof count === 'number' ? count : Number(count);
    if (!Number.isFinite(n)) throw new Error('redis: bad INCR result');
    return n;
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

  cachedStore = new MemoryStore();
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
 * load balancer we control sits in front and overwrites the header — the
 * bundled Caddyfile does exactly that). The left-most entry is the
 * convention for the original client.
 *
 * When no proxy is trusted we cannot see the socket address through
 * NextRequest, so callers get 'unknown'. Policies define an unknownLimit so
 * that case degrades to a generous shared cap instead of a site-wide throttle.
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

  return 'unknown';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

function windowIndexAndReset(windowSeconds: number): { index: number; resetAt: number } {
  const index = Math.floor(Date.now() / (windowSeconds * 1000));
  return { index, resetAt: (index + 1) * windowSeconds * 1000 };
}

function bucketKey(opts: RateLimitOptions, identity: string, windowIndex: number): string {
  return `rl:${opts.key}:${identity}:${windowIndex}`;
}

/**
 * Consume one unit from the bucket for `identity`.
 * Fails open (availability first) unless the policy sets failClosed.
 */
export async function rateLimit(
  opts: RateLimitOptions,
  identity: string
): Promise<RateLimitResult> {
  const store = getStore();
  const effectiveLimit = identity === 'unknown' && opts.unknownLimit ? opts.unknownLimit : opts.limit;
  const { index, resetAt } = windowIndexAndReset(opts.windowSeconds);
  const key = bucketKey(opts, identity, index);

  try {
    const count = await store.hit(key, opts.windowSeconds);
    const remaining = Math.max(0, effectiveLimit - count);
    return {
      allowed: count <= effectiveLimit,
      limit: effectiveLimit,
      remaining,
      resetAt,
      retryAfter: count > effectiveLimit ? Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)) : 0,
    };
  } catch (error) {
    if (opts.failClosed) {
      console.error('[rate-limit] store failure, failing CLOSED per policy:', error);
      return {
        allowed: false,
        limit: effectiveLimit,
        remaining: 0,
        resetAt,
        retryAfter: Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)),
      };
    }
    console.error('[rate-limit] store failure, failing open:', error);
    return {
      allowed: true,
      limit: effectiveLimit,
      remaining: effectiveLimit,
      resetAt,
      retryAfter: 0,
    };
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

/** Login attempts: tight, because a passcode is the only factor. Fails closed. */
export const LIMIT_ADMIN_AUTH: RateLimitOptions = {
  key: 'admin-auth',
  limit: process.env.NODE_ENV === 'production' ? 8 : 60,
  windowSeconds: 15 * 60,
  // Without a trusted proxy every caller shares one bucket — a strict global
  // login cap is exactly what we want under attack, so no unknownLimit here.
  failClosed: true,
};

/**
 * Public inquiry submissions: generous for humans, hostile to scripts.
 * When the client IP is unknown, the cap is raised so one abusive client
 * cannot consume the submissions budget of every other visitor.
 */
export const LIMIT_INQUIRIES: RateLimitOptions = {
  key: 'inquiries',
  limit: 10,
  windowSeconds: 10 * 60,
  unknownLimit: 60,
};

/** Analytics beacon: pages are cheap, but a loop must not grow the table. */
export const LIMIT_TRACK: RateLimitOptions = {
  key: 'track',
  limit: 120,
  windowSeconds: 5 * 60,
  unknownLimit: 3000,
};

/** Authenticated admin reads. */
export const LIMIT_ADMIN_API: RateLimitOptions = {
  key: 'admin-api',
  limit: 300,
  windowSeconds: 5 * 60,
  unknownLimit: 1200,
};
