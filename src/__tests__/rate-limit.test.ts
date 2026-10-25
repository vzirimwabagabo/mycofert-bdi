/**
 * Unit tests for src/lib/rate-limit.ts
 * Tests the core rateLimit function in isolation using the in-memory store.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { rateLimit, RateLimitOptions } from '../lib/rate-limit';

// Force in-memory store by ensuring Redis env vars are absent.
beforeEach(() => {
  delete process.env.RATE_LIMIT_REDIS_URL;
  delete process.env.RATE_LIMIT_REDIS_TOKEN;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

const opts: RateLimitOptions = {
  key: 'test',
  limit: 3,
  windowSeconds: 60,
};

describe('rateLimit', () => {
  it('allows requests under the limit', async () => {
    // Use a unique identity per test to avoid cross-test contamination.
    const id = `allow-${Date.now()}`;
    const r1 = await rateLimit(opts, id);
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);
  });

  it('blocks requests over the limit', async () => {
    const id = `block-${Date.now()}`;
    for (let i = 0; i < 3; i++) await rateLimit(opts, id);
    const result = await rateLimit(opts, id);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('uses unknownLimit for unknown identity', async () => {
    const optsWithUnknown: RateLimitOptions = { ...opts, limit: 2, unknownLimit: 10 };
    const r = await rateLimit(optsWithUnknown, 'unknown');
    // First hit should have a higher effective limit (10).
    expect(r.limit).toBe(10);
    expect(r.allowed).toBe(true);
  });

  it('uses regular limit for known identity', async () => {
    const optsWithUnknown: RateLimitOptions = { ...opts, limit: 2, unknownLimit: 10 };
    const r = await rateLimit(optsWithUnknown, '192.168.1.1');
    expect(r.limit).toBe(2);
  });
});
