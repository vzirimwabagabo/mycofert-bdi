import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const PASSCODE = process.env.ADMIN_PASSCODE || 'mycofert2026';

function isValidToken(token: string | null): boolean {
  if (!token) return false;
  try {
    return Buffer.from(token, 'base64').toString('utf8') === PASSCODE;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  if (!isValidToken(req.headers.get('x-admin-token'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const [inquiries, pageviewTotal, byPath, byType, newCount] = await Promise.all([
      db.inquiry.findMany({ orderBy: { createdAt: 'desc' }, take: 500 }),
      db.pageView.count(),
      db.pageView.groupBy({ by: ['path'], _count: { path: true } }),
      db.inquiry.groupBy({ by: ['type'], _count: { type: true } }),
      db.inquiry.count({ where: { status: 'new' } }),
    ]);

    const topPages = byPath
      .map((p) => ({ path: p.path, count: p._count.path }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const typeMap: Record<string, number> = {};
    for (const t of byType) typeMap[t.type] = t._count.type;

    return NextResponse.json({
      inquiries,
      stats: { total: inquiries.length, newCount, pageviews: pageviewTotal, byType: typeMap, topPages },
    });
  } catch (error) {
    console.error('[api/admin/data] GET failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!isValidToken(req.headers.get('x-admin-token'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json();
    const id = typeof body.id === 'string' ? body.id : '';
    const status = body.status === 'handled' ? 'handled' : body.status === 'new' ? 'new' : '';
    if (!id || !status) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
    await db.inquiry.update({ where: { id }, data: { status } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[api/admin/data] PATCH failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
