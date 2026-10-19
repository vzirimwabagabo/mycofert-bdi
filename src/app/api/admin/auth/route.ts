import { NextRequest, NextResponse } from 'next/server';

const PASSCODE = process.env.ADMIN_PASSCODE || 'mycofert2026';

function tokenFor(passcode: string): string {
  return Buffer.from(passcode).toString('base64');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const passcode = typeof body.passcode === 'string' ? body.passcode : '';
    if (!passcode || tokenFor(passcode) !== tokenFor(PASSCODE)) {
      return NextResponse.json({ error: 'Invalid passcode' }, { status: 401 });
    }
    return NextResponse.json({ token: tokenFor(passcode) });
  } catch (error) {
    console.error('[api/admin/auth] POST failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
