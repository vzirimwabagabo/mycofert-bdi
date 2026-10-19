import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const path = typeof body.path === 'string' ? body.path.slice(0, 200) : '';
    const lang = body.lang === 'en' ? 'en' : 'fr';
    if (!path || path.startsWith('/undefined')) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    await db.pageView.create({ data: { path, lang } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[api/track] POST failed:', error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
