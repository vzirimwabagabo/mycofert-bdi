/**
 * Unit tests for src/lib/db-retry.ts
 *
 * The distinction matters in production: a transient connection failure should
 * be retried (and reported as a retryable 503), while a real error must fail
 * immediately and be reported as a genuine fault.
 */

import { describe, it, expect, vi } from 'vitest';
import { isTransientDbError, withDbRetry } from '../lib/db-retry';

/** A Prisma-shaped error: `{ code, message }`. */
function prismaError(code: string, message = 'boom') {
  return Object.assign(new Error(message), { code });
}

describe('isTransientDbError', () => {
  it('accepts pool exhaustion (P2024)', () => {
    expect(isTransientDbError(prismaError('P2024'))).toBe(true);
  });

  it('accepts "can\'t reach database server" (P1001)', () => {
    expect(isTransientDbError(prismaError('P1001'))).toBe(true);
  });

  it('accepts socket-level failures by code', () => {
    expect(isTransientDbError(prismaError('ECONNRESET'))).toBe(true);
    expect(isTransientDbError(prismaError('ETIMEDOUT'))).toBe(true);
  });

  it('accepts a transient Prisma message even without a code', () => {
    expect(
      isTransientDbError(
        new Error('Timed out fetching a new connection from the connection pool')
      )
    ).toBe(true);
  });

  it('rejects a real query error (P2002 unique constraint)', () => {
    expect(isTransientDbError(prismaError('P2002'))).toBe(false);
  });

  it('rejects a missing row (P2025)', () => {
    expect(isTransientDbError(prismaError('P2025'))).toBe(false);
  });

  it('rejects non-error values', () => {
    expect(isTransientDbError(null)).toBe(false);
    expect(isTransientDbError(undefined)).toBe(false);
    expect(isTransientDbError('P2024')).toBe(false);
  });
});

describe('withDbRetry', () => {
  it('returns the value without retrying when the first attempt succeeds', async () => {
    const operation = vi.fn().mockResolvedValue('ok');
    await expect(withDbRetry(operation, 'test')).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('retries once and succeeds when the failure is transient', async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(prismaError('P2024'))
      .mockResolvedValue('recovered');
    await expect(withDbRetry(operation, 'test')).resolves.toBe('recovered');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('gives up after one retry and rethrows the last transient error', async () => {
    const operation = vi.fn().mockRejectedValue(prismaError('P1001'));
    await expect(withDbRetry(operation, 'test')).rejects.toMatchObject({ code: 'P1001' });
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('does not retry a real error', async () => {
    const operation = vi.fn().mockRejectedValue(prismaError('P2002'));
    await expect(withDbRetry(operation, 'test')).rejects.toMatchObject({ code: 'P2002' });
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
