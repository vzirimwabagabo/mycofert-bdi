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
// where payloadB64 = base64url(JSON.stringify({ sub, iat, exp, sv }))
// and   signatureB64 = base64url(HMAC-SHA256(payloadB64, SESSION_SECRET))
// The signed message is the *encoded payload*, so no canonicalisation of JSON
// is required at verification time.
//
// Session versioning / revocation:
//   A 32-bit integer `sv` (session version) is embedded in the token payload
//   and checked against `SiteSetting.admin_session_version` at verification
//   time. Every passcode change or recovery-code reset increments the stored
//   counter, immediately invalidating all previously-issued tokens — even
//   within the 12-hour TTL window. The DB lookup adds one round-trip per
//   admin API call, which is acceptable given the low request volume.

import { createHmac, timingSafeEqual, randomBytes, scryptSync } from 'node:crypto';

/** Token lifetime. Short enough to bound the damage of a stolen token, since
 *  there is no server-side revocation list in a stateless design. */
export const TOKEN_TTL_SECONDS = 12 * 60 * 60; // 12 hours

const ISSUER = 'mycofert-admin';

export interface AdminTokenPayload {
  sub: string; // subject — always 'admin' today, leave room for future roles
  iss: string;
  iat: number; // unix timestamp in seconds
  exp: number; // unix timestamp in seconds
  jti: string; // token id — useful for logging / future denylist
  sv: number;  // session version — incremented on every passcode change/reset
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Minimum length we accept for the session secret. 32 chars is the practical
 * floor for an HMAC key that must resist offline brute force.
 */
const MIN_SECRET_LENGTH = 32;

/**
 * Minimum length of the admin passcode. Unlike the warning-only check in
 * checkAuthConfiguration(), this one is enforced at issue time: a short
 * passcode makes the login endpoint refuse to mint tokens (fail closed)
 * instead of protecting customer data with a guessable phrase.
 */
export const MIN_PASSCODE_LENGTH = 12;

function readEnv(name: string): string | null {
  const v = process.env[name];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/** Resolved lazily (not at module load) so that tests can set env vars. */
function getConfig(): { passcode: string | null; secret: string; allowInsecure: boolean } | null {
  const passcode = readEnv('ADMIN_PASSCODE');
  const secret = readEnv('ADMIN_SESSION_SECRET');

  if (!secret) return null;
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
// Password hashing (scrypt) & verification
// ---------------------------------------------------------------------------

export interface StoredPasswordHash {
  hash: string;
  salt: string;
  updatedAt?: string;
}

/** SiteSetting rows holding the hashed credentials (never the plaintext). */
const PASSCODE_KEY = 'admin_passcode_hash';
const RECOVERY_KEY = 'admin_recovery_hash';
/** Monotonic counter embedded in tokens. Incrementing it invalidates all
 *  previously-issued sessions, even ones that have not yet expired. */
const SESSION_VERSION_KEY = 'admin_session_version';

/** Serialised { hash, salt, updatedAt } exactly as stored in SiteSetting.value. */
function hashSettingValue(plaintext: string): string {
  const { hash, salt } = hashPassword(plaintext);
  return JSON.stringify({ hash, salt, updatedAt: new Date().toISOString() });
}

/** Compute a salted scrypt hash of a password string. */
export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

/** Verify a password candidate against a stored { hash, salt } in constant time. */
export function verifyPasswordHash(candidate: string, stored: { hash: string; salt: string }): boolean {
  try {
    const candidateHash = scryptSync(candidate, stored.salt, 64).toString('hex');
    const a = Buffer.from(candidateHash, 'hex');
    const b = Buffer.from(stored.hash, 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Constant-time passcode check against an expected plaintext string.
 * Both sides are hashed with HMAC-SHA256 first, making the comparison
 * length-independent and leak-free.
 */
function passcodeMatches(candidate: string, expected: string): boolean {
  const a = createHmac('sha256', 'passcode-compare').update(candidate, 'utf8').digest();
  const b = createHmac('sha256', 'passcode-compare').update(expected, 'utf8').digest();
  return timingSafeEqual(a, b);
}

/**
 * Verify passcode candidate:
 * 1. Checks if a custom password hash exists in the database (`SiteSetting.admin_passcode_hash`).
 * 2. If absent or DB unreachable, falls back to the configured `ADMIN_PASSCODE` in `.env`.
 *
 * Note the precedence: ADMIN_PASSCODE is the *initial* passcode only. Once the
 * passcode has been changed in the dashboard (or reset with a recovery code) the
 * database row wins and the environment variable is ignored — changing `.env`
 * will NOT recover a forgotten passcode. See resetPasscodeWithRecovery() for the
 * supported way back in.
 */
export async function verifyPasscode(candidate: unknown): Promise<boolean> {
  if (typeof candidate !== 'string' || !candidate) return false;

  // 1. Check database setting
  try {
    const { db } = await import('@/lib/db');
    const row = await db.siteSetting.findUnique({ where: { key: PASSCODE_KEY } });
    if (row && row.value) {
      const stored = JSON.parse(row.value) as StoredPasswordHash;
      if (stored.hash && stored.salt) {
        return verifyPasswordHash(candidate, stored);
      }
    }
  } catch (error) {
    console.warn('[auth] DB password lookup failed, falling back to environment variable:', error);
  }

  // 2. Fall back to environment variable
  const config = getConfig();
  if (!config || !config.passcode) return false;
  return passcodeMatches(candidate, config.passcode);
}

/**
 * Read the current session version from the database.
 * Returns 0 if the row does not exist yet (first use before any passcode change).
 * Fails open: a DB error should not block auth verification on an unrelated host.
 */
async function readSessionVersion(): Promise<number> {
  try {
    const { db } = await import('@/lib/db');
    const row = await db.siteSetting.findUnique({ where: { key: SESSION_VERSION_KEY } });
    if (!row?.value) return 0;
    const n = Number.parseInt(row.value, 10);
    return Number.isFinite(n) ? n : 0;
  } catch (error) {
    console.warn('[auth] session-version lookup failed (failing open):', error);
    return -1; // sentinel: skip version check on DB errors to avoid locking everyone out
  }
}

/**
 * Atomically increment the session version.
 * Called on every passcode change or recovery-code reset to invalidate existing tokens.
 * Returns the new version number.
 */
async function bumpSessionVersion(): Promise<number> {
  const { db } = await import('@/lib/db');
  // Read current value and increment in a transaction so concurrent resets don't
  // produce the same new version.
  const row = await db.siteSetting.findUnique({ where: { key: SESSION_VERSION_KEY } });
  const next = (row?.value ? (Number.parseInt(row.value, 10) || 0) : 0) + 1;
  await db.siteSetting.upsert({
    where: { key: SESSION_VERSION_KEY },
    create: { key: SESSION_VERSION_KEY, value: String(next) },
    update: { value: String(next) },
  });
  return next;
}

/**
 * Update the admin passcode in the database.
 * Requires the current passcode to match.
 */
export async function updateAdminPasscode(
  currentPasscode: string,
  newPasscode: string
): Promise<{ ok: boolean; reason?: 'invalid-current' | 'weak-new' | 'not-configured' }> {
  const config = getConfig();
  if (!config) return { ok: false, reason: 'not-configured' };

  const valid = await verifyPasscode(currentPasscode);
  if (!valid) return { ok: false, reason: 'invalid-current' };

  if (typeof newPasscode !== 'string' || newPasscode.length < MIN_PASSCODE_LENGTH) {
    return { ok: false, reason: 'weak-new' };
  }

  const { db } = await import('@/lib/db');
  const value = hashSettingValue(newPasscode);
  await db.siteSetting.upsert({
    where: { key: PASSCODE_KEY },
    create: { key: PASSCODE_KEY, value },
    update: { value },
  });

  // Invalidate all previously-issued sessions so a stolen token cannot be used
  // after a passcode change.
  await bumpSessionVersion();

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Recovery codes
// ---------------------------------------------------------------------------
//
// The way back in when the passcode is forgotten.
//
// This deployment has a single shared passphrase and no email service, so
// "forgot passcode" used to mean editing the environment file (which the
// database then ignores) or hand-editing the database — i.e. a support ticket
// for an owner who has no IT support. Instead the owner generates a recovery
// code while signed in and keeps it off the machine (paper, phone note).
//
// Properties:
//   * Stored only as a scrypt hash, like the passcode.
//   * Single use — a successful reset immediately mints a replacement code, so
//     a code that leaked (or was used) cannot be replayed.

/** 32 symbols: digits and letters with no look-alikes (no I, O, 0, 1). */
const RECOVERY_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const RECOVERY_GROUPS = 4;
const RECOVERY_GROUP_LENGTH = 4;

/**
 * 16 characters × log2(32) = 80 bits of entropy, e.g. "K7QM-4RTP-9XWB-H2ND".
 * Grouped in fours because it is meant to be copied onto paper by hand.
 */
export function generateRecoveryCode(): string {
  const total = RECOVERY_GROUPS * RECOVERY_GROUP_LENGTH;
  // 256 is a multiple of 32, so the modulo is unbiased.
  const chars = Array.from(randomBytes(total), (b) => RECOVERY_ALPHABET[b % RECOVERY_ALPHABET.length]);
  return chars.join('').replace(new RegExp(`.{${RECOVERY_GROUP_LENGTH}}(?=.)`, 'g'), '$&-');
}

/** Case- and separator-insensitive, so a code typed off paper still matches. */
function normalizeRecoveryCode(code: string): string {
  return code.toUpperCase().replace(/[^0-9A-Z]/g, '');
}

/** Read the stored recovery hash, or null when none has been generated yet. */
async function readStoredRecovery(): Promise<StoredPasswordHash | null> {
  try {
    const { db } = await import('@/lib/db');
    const row = await db.siteSetting.findUnique({ where: { key: RECOVERY_KEY } });
    if (!row?.value) return null;
    const stored = JSON.parse(row.value) as StoredPasswordHash;
    return stored.hash && stored.salt ? stored : null;
  } catch (error) {
    console.warn('[auth] recovery-code lookup failed:', error);
    return null;
  }
}

/** Replace the recovery code with a freshly generated one and return the plaintext. */
export async function issueRecoveryCode(): Promise<string> {
  const code = generateRecoveryCode();
  const { db } = await import('@/lib/db');
  const value = hashSettingValue(normalizeRecoveryCode(code));
  await db.siteSetting.upsert({
    where: { key: RECOVERY_KEY },
    create: { key: RECOVERY_KEY, value },
    update: { value },
  });
  return code;
}

export type RecoveryResetResult =
  | { ok: true; recoveryCode: string }
  | { ok: false; reason: 'not-configured' | 'no-recovery-code' | 'invalid-code' | 'weak-new' };

/**
 * Set a new passcode using a recovery code.
 *
 * The passcode and the replacement recovery code are written in one
 * transaction: there is no window in which the old code has been consumed but
 * no new one exists.
 *
 * Sessions issued before the reset stay valid until they expire — tokens are
 * stateless and HMAC-signed, so there is nothing to revoke. Callers should not
 * imply otherwise.
 */
export async function resetPasscodeWithRecovery(
  recoveryCode: string,
  newPasscode: string
): Promise<RecoveryResetResult> {
  if (!getConfig()) return { ok: false, reason: 'not-configured' };
  if (typeof newPasscode !== 'string' || newPasscode.length < MIN_PASSCODE_LENGTH) {
    return { ok: false, reason: 'weak-new' };
  }

  const stored = await readStoredRecovery();
  if (!stored) return { ok: false, reason: 'no-recovery-code' };

  if (typeof recoveryCode !== 'string' || !verifyPasswordHash(normalizeRecoveryCode(recoveryCode), stored)) {
    return { ok: false, reason: 'invalid-code' };
  }

  const replacement = generateRecoveryCode();
  const passcodeValue = hashSettingValue(newPasscode);
  const recoveryValue = hashSettingValue(normalizeRecoveryCode(replacement));

  const { db } = await import('@/lib/db');
  await db.$transaction([
    db.siteSetting.upsert({
      where: { key: PASSCODE_KEY },
      create: { key: PASSCODE_KEY, value: passcodeValue },
      update: { value: passcodeValue },
    }),
    db.siteSetting.upsert({
      where: { key: RECOVERY_KEY },
      create: { key: RECOVERY_KEY, value: recoveryValue },
      update: { value: recoveryValue },
    }),
  ]);

  // Bump session version AFTER the transaction so all tokens issued before this
  // reset become invalid, even if they have not yet expired.
  await bumpSessionVersion();

  return { ok: true, recoveryCode: replacement };
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
  reason: 'not-configured' | 'invalid-passcode' | 'weak-passcode';
}

function mintToken(secret: string, sessionVersion: number): IssueResult {
  const now = Math.floor(Date.now() / 1000);
  const payload: AdminTokenPayload = {
    sub: 'admin',
    iss: ISSUER,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
    jti: randomBytes(12).toString('hex'),
    sv: sessionVersion,
  };

  const encoded = b64urlEncode(Buffer.from(JSON.stringify(payload), 'utf8'));
  return { ok: true, token: `${encoded}.${sign(encoded, secret)}`, expiresAt: payload.exp };
}

/**
 * Synchronous token issuance (primarily for tests and backwards compatibility).
 * Checks against environment variable ADMIN_PASSCODE.
 * NOTE: does not embed a real session version (uses 0) — only for unit tests.
 */
export function issueToken(passcode: unknown): IssueResult | IssueFailure {
  const config = getConfig();
  if (!config || !config.passcode) return { ok: false, reason: 'not-configured' };
  if (config.passcode.length < MIN_PASSCODE_LENGTH) {
    return { ok: false, reason: 'weak-passcode' };
  }
  if (typeof passcode !== 'string' || !passcode) return { ok: false, reason: 'invalid-passcode' };
  if (!passcodeMatches(passcode, config.passcode)) return { ok: false, reason: 'invalid-passcode' };

  return mintToken(config.secret, 0);
}

/**
 * Asynchronous token issuance. Checks database-stored hash first, then falls back to env.
 * Embeds the current session version so the token can be revoked by a passcode change.
 */
export async function issueTokenAsync(passcode: unknown): Promise<IssueResult | IssueFailure> {
  const config = getConfig();
  if (!config) return { ok: false, reason: 'not-configured' };
  if (typeof passcode !== 'string' || !passcode) return { ok: false, reason: 'invalid-passcode' };
  if (passcode.length < MIN_PASSCODE_LENGTH) return { ok: false, reason: 'weak-passcode' };

  const valid = await verifyPasscode(passcode);
  if (!valid) return { ok: false, reason: 'invalid-passcode' };

  const sv = await readSessionVersion();
  return mintToken(config.secret, sv < 0 ? 0 : sv);
}

export type VerifyResult =
  | { ok: true; payload: AdminTokenPayload }
  | { ok: false; reason: 'missing' | 'malformed' | 'bad-signature' | 'expired' | 'not-configured' | 'revoked' };

/**
 * Verify a token. Never throws — every failure path returns a discriminated
 * result so route handlers can map it to the right status code.
 *
 * This is the synchronous structural check only (signature + expiry). For
 * routes that also need session-version revocation checking, call
 * verifyRequestAsync() instead.
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
 * Verify the admin token on an incoming request — synchronous structural check.
 * Pass the header value: `verifyRequest(req.headers.get(ADMIN_TOKEN_HEADER))`.
 */
export function verifyRequest(tokenHeader: string | null): VerifyResult {
  return verifyToken(tokenHeader);
}

/**
 * Verify the admin token including a session-version revocation check.
 *
 * Tokens issued before a passcode change carry a lower `sv` than the stored
 * counter. This rejects them even if they have not yet hit their 12-hour TTL,
 * making passcode changes take immediate effect across all instances.
 *
 * The DB lookup adds one round-trip per admin API call. Admin requests are
 * rare enough that this is acceptable. On a DB error the version check is
 * skipped (fail open) so a transient outage does not lock out the admin.
 */
export async function verifyRequestAsync(tokenHeader: string | null): Promise<VerifyResult> {
  const base = verifyToken(tokenHeader);
  if (!base.ok) return base;

  const storedVersion = await readSessionVersion();
  // storedVersion === -1 means the DB lookup failed; skip version check.
  if (storedVersion >= 0) {
    const tokenVersion = typeof base.payload.sv === 'number' ? base.payload.sv : 0;
    if (tokenVersion < storedVersion) {
      return { ok: false, reason: 'revoked' };
    }
  }

  return base;
}

/**
 * Startup warning. Called from instrumentation so a misconfigured production
 * deploy is loud in the logs instead of silently rejecting every login.
 */
export function checkAuthConfiguration(): string[] {
  const warnings: string[] = [];
  const passcode = readEnv('ADMIN_PASSCODE');
  const secret = readEnv('ADMIN_SESSION_SECRET');

  if (!passcode) warnings.push('ADMIN_PASSCODE is not set in environment (database passcode or setup required).');
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
