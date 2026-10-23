import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ADMIN_TOKEN_HEADER, verifyRequest } from '@/lib/auth';
import {
  LIMIT_ADMIN_API,
  rateLimitRequest,
  rateLimitHeaders,
  getClientIp,
} from '@/lib/rate-limit';

/** Default page size for the inquiry list. */
const PAGE_SIZE_DEFAULT = 50;
const PAGE_SIZE_MAX = 200;

/**
 * Authorise an admin request.
 * Returns a NextResponse to send on failure, or null when the caller may proceed.
 */
async function authorize(req: NextRequest): Promise<NextResponse | null> {
  const limit = await rateLimitRequest(req, LIMIT_ADMIN_API);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: rateLimitHeaders(limit) }
    );
  }

  const result = verifyRequest(req.headers.get(ADMIN_TOKEN_HEADER));
  if (!result.ok) {
    if (result.reason === 'not-configured') {
      return NextResponse.json({ error: 'Admin authentication is not configured' }, { status: 503 });
    }
    // Distinguish "expired" so the client can prompt for the passcode again
    // without treating it as a spoofing attempt.
    return NextResponse.json(
      { error: result.reason === 'expired' ? 'Session expired' : 'Unauthorized' },
      { status: 401, headers: result.reason === 'expired' ? { 'X-Session-Expired': '1' } : undefined }
    );
  }
  return null;
}

function parsePositiveInt(value: string | null, fallback: number, max: number): number {
  if (!value) return fallback;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, max);
}

export async function GET(req: NextRequest) {
  const denied = await authorize(req);
  if (denied) return denied;

  try {
    const { searchParams } = new URL(req.url);
    const page = parsePositiveInt(searchParams.get('page'), 1, 10_000);
    const pageSize = parsePositiveInt(searchParams.get('pageSize'), PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX);
    const statusFilter = searchParams.get('status');
    const where = statusFilter === 'new' || statusFilter === 'handled' ? { status: statusFilter } : {};

    // Paginated explicitly: the previous fixed `take: 500` made the dashboard
    // silently wrong once the table grew past the cap.
    const [inquiries, total, totalAll, pageviewTotal, byPath, byType, newCount] = await Promise.all([
      db.inquiry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.inquiry.count({ where }),
      db.inquiry.count(),
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
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
      stats: {
        // `total` is the unfiltered count — what the dashboard labels "Total".
        total: totalAll,
        filtered: total,
        newCount,
        pageviews: pageviewTotal,
        byType: typeMap,
        topPages,
      },
    });
  } catch (error) {
    console.error('[api/admin/data] GET failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const denied = await authorize(req);
  if (denied) return denied;

  try {
    const body = await req.json().catch(() => null);
    const id = body && typeof body === 'object' ? (body as { id?: unknown }).id : undefined;
    const rawStatus = body && typeof body === 'object' ? (body as { status?: unknown }).status : undefined;
    const status = rawStatus === 'handled' ? 'handled' : rawStatus === 'new' ? 'new' : '';

    if (typeof id !== 'string' || !id || !status) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const updated = await db.inquiry.update({ where: { id }, data: { status } });
    return NextResponse.json({ ok: true, inquiry: updated });
  } catch (error) {
    // A missing row is a client error, not a server fault.
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return NextResponse.json({ error: 'Inquiry not found' }, { status: 404 });
    }
    console.error('[api/admin/data] PATCH failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const denied = await authorize(req);
  if (denied) return denied;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    await db.inquiry.delete({ where: { id } });
    console.info(`[api/admin/data] inquiry deleted by ${getClientIp(req)}`);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return NextResponse.json({ error: 'Inquiry not found' }, { status: 404 });
    }
    console.error('[api/admin/data] DELETE failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
