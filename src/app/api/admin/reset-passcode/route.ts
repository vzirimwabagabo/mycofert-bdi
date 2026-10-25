// Reset the admin passcode with a recovery code — the "I forgot it" path.
//
// Unauthenticated by definition (whoever needs it cannot sign in), which makes
// it the most sensitive endpoint in the app. Hence: hard rate limiting, no
// detail about why a code was rejected, and the code is consumed on use.
//
// It does NOT issue a session token: the owner signs in normally afterwards, so
// this endpoint cannot be turned into a login bypass.

import { NextRequest, NextResponse } from 'next/server';
import { isAuthConfigured, resetPasscodeWithRecovery } from '@/lib/auth';
import { LIMIT_ADMIN_AUTH, rateLimitRequest, rateLimitHeaders } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const limit = await rateLimitRequest(req, LIMIT_ADMIN_AUTH);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many attempts. Try again later.' },
      { status: 429, headers: rateLimitHeaders(limit) }
    );
  }

  if (!isAuthConfigured()) {
    return NextResponse.json(
      { error: 'Admin authentication is not configured on this server.' },
      { status: 503, headers: rateLimitHeaders(limit) }
    );
  }

  try {
    const body = await req.json().catch(() => null);
    const recoveryCode = typeof body?.recoveryCode === 'string' ? body.recoveryCode : '';
    const newPasscode = typeof body?.newPasscode === 'string' ? body.newPasscode : '';

    if (!recoveryCode || !newPasscode) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const result = await resetPasscodeWithRecovery(recoveryCode, newPasscode);

    if (!result.ok) {
      if (result.reason === 'no-recovery-code') {
        // Actionable on purpose: there is genuinely no way in without it, and
        // the owner needs to know what to ask for.
        return NextResponse.json(
          {
            error:
              'No recovery code has been set up for this dashboard. Whoever hosts the site can reset the passcode from the server.',
          },
          { status: 400, headers: rateLimitHeaders(limit) }
        );
      }
      if (result.reason === 'weak-new') {
        return NextResponse.json(
          { error: 'New passcode must be at least 12 characters' },
          { status: 400, headers: rateLimitHeaders(limit) }
        );
      }
      if (result.reason === 'not-configured') {
        return NextResponse.json({ error: 'Admin authentication is not configured on this server.' }, { status: 503 });
      }
      console.warn('[api/admin/reset-passcode] rejected an invalid recovery code');
      return NextResponse.json({ error: 'Invalid recovery code' }, { status: 400, headers: rateLimitHeaders(limit) });
    }

    console.warn('[api/admin/reset-passcode] admin passcode was reset using a recovery code');
    // The replacement code is returned because the used one is now dead — the
    // owner must not be left without a way back in.
    return NextResponse.json(
      { ok: true, recoveryCode: result.recoveryCode },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('[api/admin/reset-passcode] POST failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
