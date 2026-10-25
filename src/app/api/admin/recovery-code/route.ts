// Generate (or replace) the recovery code for the admin dashboard.
//
// Requires an authenticated session AND the current passcode: a stolen session
// token alone must not be enough to mint a credential that outlives the session
// and survives a later passcode change.
//
// The plaintext is returned exactly once, here. Only its scrypt hash is stored.

import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_TOKEN_HEADER, issueRecoveryCode, verifyPasscode, verifyRequest } from '@/lib/auth';
import { LIMIT_ADMIN_API, rateLimitRequest, rateLimitHeaders } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const limit = await rateLimitRequest(req, LIMIT_ADMIN_API);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: rateLimitHeaders(limit) }
    );
  }

  const auth = verifyRequest(req.headers.get(ADMIN_TOKEN_HEADER));
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.reason === 'expired' ? 'Session expired' : 'Unauthorized' },
      { status: 401, headers: auth.reason === 'expired' ? { 'X-Session-Expired': '1' } : undefined }
    );
  }

  try {
    const body = await req.json().catch(() => null);
    const passcode = typeof body?.passcode === 'string' ? body.passcode : '';
    if (!passcode || !(await verifyPasscode(passcode))) {
      console.warn('[api/admin/recovery-code] rejected: current passcode did not match');
      return NextResponse.json({ error: 'Current passcode is incorrect' }, { status: 400, headers: rateLimitHeaders(limit) });
    }

    const recoveryCode = await issueRecoveryCode();
    console.info('[api/admin/recovery-code] recovery code generated (previous code, if any, is now invalid)');
    return NextResponse.json({ recoveryCode }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[api/admin/recovery-code] POST failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
