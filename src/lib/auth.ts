// Admin authentication — stateless, signed, expiring tokens.
//
// Design constraints (must hold for multi-instance / load-balanced deploys):
//   * No server-side session store: every instance must be able to verify a
//     token on its own, so the token is self-contained and HMAC-signed.
//   * The token MUST NOT reveal the passcode. The old implementation returned
//     base64(passcode), which is trivially reversible.
//   * Verification is constant-time, so an attacker cannot recover a valid
//     signature byte-by-byte through timing.
//   * Fail closed: if the required secrets are absent, authentication is
//     impossible rather than falling back to a public default passcode.
//
// Token format (all base64url):
//   <payloadB64>.<signatureB64>
// where payloadB64 = base64url(JSON.stringify({ sub, iat, exp }))
// and   signatureB64 = base64url(HMAC-SHA256(payloadB64, SESSION_SECRET))
// The signed message is the *encoded payload*, so no canonicalisation of JSON
// is required at verification time.

import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';

/** Token lifetime. Short enough to bound the damage of a stolen token, since
 *  there is no server-side revocation list in a stateless design. */
export const TOKEN_TTL_SECONDS = 12 * 60 * 60; // 12 hours

const ISSUER = 'mycofert-admin';

export interface AdminTokenPayload {
  sub: string; // subject — always 'admin' today, leave room for future roles
  iss: string;
  iat: number; // issued at, unix seconds
  exp: number; // expires at, unix seconds
  jti: string; // token id — useful for logging / future denylist
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Minimum length we accept for the session secret. 32 chars is the practical
 * floor for an HMAC key that must resist offline brute force.
 */
const MIN_SECRET_LENGTH = 32;

function readEnv(name: string): string | null {
  const v = process.env[name];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/** Resolved lazily (not at module load) so that tests can set env vars. */
function getConfig(): { passcode: string; secret: string; allowInsecure: boolean } | null {
  const passcode = readEnv('ADMIN_PASSCODE');
  const secret = readEnv('ADMIN_SESSION_SECRET');

  if (!passcode || !secret) return null;
  if (secret.length < MIN_SECRET_LENGTH) return null;

  return {
    passcode,
    secret,
    // Dev-only escape hatch, never enabled in production builds.
    allowInsecure: process.env.NODE_ENV !== 'production' && readEnv('ADMIN_ALLOW_INSECURE') === '1',
  };
}

/**
 * True when the auth subsystem is correctly configured. Routes call this to
 * return a clear 503 instead of a confusing 401 when secrets are missing.
 */
export function isAuthConfigured(): boolean {
  return getConfig() !== null;
}

// ---------------------------------------------------------------------------
// Base64url helpers
// ---------------------------------------------------------------------------

function b64urlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): Buffer | null {
  try {
    const padded = s.replace(/-/g, '+').replace(/_/g, '/');
    const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
    const buf = Buffer.from(padded + pad, 'base64');
    // Round-trip check: rejects strings that are not valid base64url.
    if (b64urlEncode(buf) !== s.replace(/=+$/, '')) return null;
    return buf;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Passcode verification
// ---------------------------------------------------------------------------

/**
 * Constant-time passcode check.
 *
 * Both sides are hashed to a fixed 32 bytes first, which makes the comparison
 * length-independent and therefore free of the length leak that a raw
 * `timingSafeEqual` on differently-sized buffers would introduce.
 */
function passcodeMatches(candidate: string, expected: string): boolean {
  const a = createHmac('sha256', 'passcode-compare').update(candidate, 'utf8').digest();
  const b = createHmac('sha256', 'passcode-compare').update(expected, 'utf8').digest();
  return timingSafeEqual(a, b);
}

// ---------------------------------------------------------------------------
// Sign / verify
// ---------------------------------------------------------------------------

function sign(encodedPayload: string, secret: string): string {
  return b64urlEncode(createHmac('sha256', secret).update(encodedPayload, 'utf8').digest());
}

export interface IssueResult {
  ok: true;
  token: string;
  expiresAt: number;
}
export interface IssueFailure {
  ok: false;
  reason: 'not-configured' | 'invalid-passcode';
}

/**
 * Exchange a passcode for a signed token. Returns `not-configured` when the
 * deployment is missing its secrets, so callers can distinguish a server
 * misconfiguration from a wrong password.
 */
export function issueToken(passcode: unknown): IssueResult | IssueFailure {
  const config = getConfig();
  if (!config) return { ok: false, reason: 'not-configured' };
  if (typeof passcode !== 'string' || !passcode) return { ok: false, reason: 'invalid-passcode' };
  if (!passcodeMatches(passcode, config.passcode)) return { ok: false, reason: 'invalid-passcode' };

  const now = Math.floor(Date.now() / 1000);
  const payload: AdminTokenPayload = {
    sub: 'admin',
    iss: ISSUER,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
    jti: randomBytes(12).toString('hex'),
  };

  const encoded = b64urlEncode(Buffer.from(JSON.stringify(payload), 'utf8'));
  return { ok: true, token: `${encoded}.${sign(encoded, config.secret)}`, expiresAt: payload.exp };
}

export type VerifyResult =
  | { ok: true; payload: AdminTokenPayload }
  | { ok: false; reason: 'missing' | 'malformed' | 'bad-signature' | 'expired' | 'not-configured' };

/**
 * Verify a token. Never throws — every failure path returns a discriminated
 * result so route handlers can map it to the right status code.
 */
export function verifyToken(token: unknown): VerifyResult {
  const config = getConfig();
  if (!config) return { ok: false, reason: 'not-configured' };
  if (typeof token !== 'string' || !token) return { ok: false, reason: 'missing' };

  const parts = token.split('.');
  if (parts.length !== 2) return { ok: false, reason: 'malformed' };
  const [encoded, providedSig] = parts;
  if (!encoded || !providedSig) return { ok: false, reason: 'malformed' };

  // Signature check first — never parse an unauthenticated payload.
  const expectedSig = sign(encoded, config.secret);
  const a = Buffer.from(providedSig, 'utf8');
  const b = Buffer.from(expectedSig, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: 'bad-signature' };

  const rawPayload = b64urlDecode(encoded);
  if (!rawPayload) return { ok: false, reason: 'malformed' };

  let payload: AdminTokenPayload;
  try {
    payload = JSON.parse(rawPayload.toString('utf8')) as AdminTokenPayload;
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  if (
    !payload ||
    typeof payload.exp !== 'number' ||
    typeof payload.sub !== 'string' ||
    payload.iss !== ISSUER
  ) {
    return { ok: false, reason: 'malformed' };
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) return { ok: false, reason: 'expired' };

  return { ok: true, payload };
}

// ---------------------------------------------------------------------------
// Request helper
// ---------------------------------------------------------------------------

/** Header carrying the admin token. Prefer this over reading req.headers directly. */
export const ADMIN_TOKEN_HEADER = 'x-admin-token';

/**
 * Verify the admin token on an incoming request.
 * Pass the header value: `verifyRequest(req.headers.get(ADMIN_TOKEN_HEADER))`.
 */
export function verifyRequest(tokenHeader: string | null): VerifyResult {
  return verifyToken(tokenHeader);
}

/**
 * Startup warning. Called from instrumentation so a misconfigured production
 * deploy is loud in the logs instead of silently rejecting every login.
 */
export function checkAuthConfiguration(): string[] {
  const warnings: string[] = [];
  const passcode = readEnv('ADMIN_PASSCODE');
  const secret = readEnv('ADMIN_SESSION_SECRET');

  if (!passcode) warnings.push('ADMIN_PASSCODE is not set — the admin dashboard is unreachable.');
  if (!secret) {
    warnings.push('ADMIN_SESSION_SECRET is not set — the admin dashboard is unreachable.');
  } else if (secret.length < MIN_SECRET_LENGTH) {
    warnings.push(
      `ADMIN_SESSION_SECRET is too short (${secret.length} < ${MIN_SECRET_LENGTH}) — refused.`
    );
  }
  if (passcode && passcode.length < 12) {
    warnings.push('ADMIN_PASSCODE is shorter than 12 characters — use a longer passphrase.');
  }
  return warnings;
}
