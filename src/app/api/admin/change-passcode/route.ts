import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_TOKEN_HEADER, verifyRequestAsync, updateAdminPasscode } from '@/lib/auth';
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

  const auth = await verifyRequestAsync(req.headers.get(ADMIN_TOKEN_HEADER));
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.reason === 'revoked' ? 'Session revoked — please sign in again' : auth.reason === 'expired' ? 'Session expired' : 'Unauthorized' },
      { status: 401, headers: auth.reason === 'expired' ? { 'X-Session-Expired': '1' } : auth.reason === 'revoked' ? { 'X-Session-Revoked': '1' } : undefined }
    );
  }

  try {
    const body = await req.json().catch(() => null);
    const currentPasscode = typeof body?.currentPasscode === 'string' ? body.currentPasscode : '';
    const newPasscode = typeof body?.newPasscode === 'string' ? body.newPasscode : '';

    if (!currentPasscode || !newPasscode) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const result = await updateAdminPasscode(currentPasscode, newPasscode);
    if (!result.ok) {
      if (result.reason === 'invalid-current') {
        return NextResponse.json({ error: 'Current passcode is incorrect' }, { status: 400 });
      }
      if (result.reason === 'weak-new') {
        return NextResponse.json({ error: 'New passcode must be at least 12 characters' }, { status: 400 });
      }
      return NextResponse.json({ error: 'Authentication not configured' }, { status: 503 });
    }

    return NextResponse.json({ ok: true, message: 'Passcode updated successfully' });
  } catch (error) {
    console.error('[api/admin/change-passcode] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
