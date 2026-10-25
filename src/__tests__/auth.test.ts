/**
 * Unit tests for src/lib/auth.ts
 * Tests the stateless HMAC token system in isolation.
 *
 * NOTE: isAuthConfigured() now only requires ADMIN_SESSION_SECRET (the signing
 * key). ADMIN_PASSCODE is optional because the admin passcode can be stored as
 * a salted hash in the database (set from the Admin > Site content > Security
 * panel). isAuthConfigured() returns false only when the SESSION_SECRET is
 * absent or too short, since the session cannot function without it.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { issueToken, verifyToken, isAuthConfigured } from '../lib/auth';

const VALID_PASSCODE = 'test-passcode-secure!';
const VALID_SECRET = 'test-session-secret-0123456789abcdef0123456789';

describe('auth', () => {
  beforeEach(() => {
    process.env.ADMIN_PASSCODE = VALID_PASSCODE;
    process.env.ADMIN_SESSION_SECRET = VALID_SECRET;
  });

  describe('isAuthConfigured', () => {
    it('returns true when both env vars are set', () => {
      expect(isAuthConfigured()).toBe(true);
    });

    it('returns true when ADMIN_PASSCODE is missing (DB-stored passcode supported)', () => {
      // Passcode can live in the database; only the session secret is mandatory.
      delete process.env.ADMIN_PASSCODE;
      expect(isAuthConfigured()).toBe(true);
    });

    it('returns false when ADMIN_SESSION_SECRET is missing', () => {
      delete process.env.ADMIN_SESSION_SECRET;
      expect(isAuthConfigured()).toBe(false);
    });

    it('returns false when secret is too short', () => {
      process.env.ADMIN_SESSION_SECRET = 'tooshort';
      expect(isAuthConfigured()).toBe(false);
    });
  });

  describe('issueToken', () => {
    it('issues a valid token for the correct passcode', () => {
      const result = issueToken(VALID_PASSCODE);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
        expect(result.expiresAt).toBeGreaterThan(Date.now() / 1000);
      }
    });

    it('rejects wrong passcode', () => {
      const result = issueToken('wrong-passcode');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('invalid-passcode');
    });

    it('rejects non-string passcode', () => {
      const result = issueToken(null);
      expect(result.ok).toBe(false);
    });

    it('returns not-configured when secrets absent', () => {
      delete process.env.ADMIN_PASSCODE;
      const result = issueToken(VALID_PASSCODE);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('not-configured');
    });

    it('returns weak-passcode for short passcodes', () => {
      process.env.ADMIN_PASSCODE = 'short';
      const result = issueToken('short');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('weak-passcode');
    });
  });

  describe('verifyToken', () => {
    it('verifies a just-issued token', () => {
      const issued = issueToken(VALID_PASSCODE);
      expect(issued.ok).toBe(true);
      if (!issued.ok) return;

      const verified = verifyToken(issued.token);
      expect(verified.ok).toBe(true);
      if (verified.ok) {
        expect(verified.payload.sub).toBe('admin');
      }
    });

    it('rejects a tampered token', () => {
      const issued = issueToken(VALID_PASSCODE);
      expect(issued.ok).toBe(true);
      if (!issued.ok) return;

      const [payload, sig] = issued.token.split('.');
      const tampered = `${payload}X.${sig}`;
      const result = verifyToken(tampered);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('bad-signature');
    });

    it('rejects a missing token', () => {
      const result = verifyToken(null);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('missing');
    });

    it('rejects a malformed token', () => {
      const result = verifyToken('not-a-token');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('malformed');
    });
  });
});
