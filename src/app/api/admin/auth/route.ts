import { NextRequest, NextResponse } from 'next/server';
import { isAuthConfigured, issueToken } from '@/lib/auth';
import { LIMIT_ADMIN_AUTH, rateLimitRequest, rateLimitHeaders } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  // Rate limit before doing any work, so brute force costs the attacker even
  // when the passcode is wrong.
  const limit = await rateLimitRequest(req, LIMIT_ADMIN_AUTH);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many attempts. Try again later.' },
      { status: 429, headers: rateLimitHeaders(limit) }
    );
  }

  // Fail closed with a clear status when the deployment is misconfigured,
  // instead of silently accepting a default passcode.
  if (!isAuthConfigured()) {
    console.error(
      '[api/admin/auth] ADMIN_PASSCODE / ADMIN_SESSION_SECRET are not configured — refusing logins.'
    );
    return NextResponse.json(
      { error: 'Admin authentication is not configured on this server.' },
      { status: 503, headers: rateLimitHeaders(limit) }
    );
  }

  try {
    const body = await req.json().catch(() => null);
    const passcode = body && typeof body === 'object' ? (body as { passcode?: unknown }).passcode : undefined;

    const result = issueToken(passcode);
    if (!result.ok) {
      // Same message and status for every failure — do not reveal whether the
      // passcode was missing, wrong, or the server unconfigured.
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401, headers: rateLimitHeaders(limit) }
      );
    }

    return NextResponse.json(
      { token: result.token, expiresAt: result.expiresAt },
      { status: 200, headers: rateLimitHeaders(limit) }
    );
  } catch (error) {
    console.error('[api/admin/auth] POST failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
