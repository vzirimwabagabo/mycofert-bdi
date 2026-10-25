import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isTransientDbError, withDbRetry } from '@/lib/db-retry';
import { ADMIN_TOKEN_HEADER, verifyRequestAsync } from '@/lib/auth';
import {
  LIMIT_ADMIN_API,
  rateLimitRequest,
  rateLimitHeaders,
  getClientIp,
} from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/** Default page size for the inquiry list. */
const PAGE_SIZE_DEFAULT = 50;
const PAGE_SIZE_MAX = 200;

/**
 * How many days of PageView data to include in the dashboard analytics.
 * Limiting the window keeps the GROUP BY fast even with a large table by
 * allowing Postgres to use a partial index or range scan instead of scanning
 * the entire table. The full retention period (PAGEVIEW_RETENTION_DAYS) still
 * applies for pruning — this is only a query bound.
 */
const ANALYTICS_WINDOW_DAYS = 30;

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

  // verifyRequestAsync performs the session-version check: tokens issued before
  // a passcode change are rejected even within their 12-hour TTL window.
  const result = await verifyRequestAsync(req.headers.get(ADMIN_TOKEN_HEADER));
  if (!result.ok) {
    if (result.reason === 'not-configured') {
      return NextResponse.json({ error: 'Admin authentication is not configured' }, { status: 503 });
    }
    if (result.reason === 'revoked') {
      return NextResponse.json(
        { error: 'Session revoked — please sign in again' },
        { status: 401, headers: { 'X-Session-Revoked': '1' } }
      );
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

    // One $transaction rather than seven parallel promises. The pool holds a
    // single connection (connection_limit=1), so separate queries queue behind
    // one another and each pays a full network round trip; on a slow link that
    // is how a remote database turns into P2024 "timed out fetching a
    // connection from the pool". Batching costs one round trip instead, and the
    // "new" badge and total pageviews are derived from the groupings below so
    // they need no query of their own.
    //
    // Paginated explicitly: the previous fixed `take: 500` made the dashboard
    // silently wrong once the table grew past the cap.
    //
    // Analytics window: pageview aggregation is capped to ANALYTICS_WINDOW_DAYS
    // (30 days) so the GROUP BY scans a bounded range rather than the full
    // table. The total count still reflects the complete retention window, but
    // the top-pages breakdown is explicitly labelled as "last 30 days".
    const analyticsAfter = new Date(Date.now() - ANALYTICS_WINDOW_DAYS * 86_400_000);
    const [inquiries, total, byStatus, byPath, byType] = await withDbRetry(
      () =>
        db.$transaction([
          db.inquiry.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * pageSize,
            take: pageSize,
          }),
          db.inquiry.count({ where }),
          db.inquiry.groupBy({ by: ['status'], _count: { _all: true } }),
          db.pageView.groupBy({
            by: ['path'],
            where: { createdAt: { gte: analyticsAfter } },
            _count: { path: true },
          }),
          db.inquiry.groupBy({ by: ['type'], _count: { type: true } }),
        ]),
      'admin/data GET'
    );

    const totalAll = byStatus.reduce((sum, row) => sum + row._count._all, 0);
    const newCount = byStatus.find((row) => row.status === 'new')?._count._all ?? 0;
    const pageviewTotal = byPath.reduce((sum, row) => sum + row._count.path, 0);

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
        // pageviews and topPages are bounded to the last ANALYTICS_WINDOW_DAYS days
        // so the query stays fast as the table grows.
        analyticsWindowDays: ANALYTICS_WINDOW_DAYS,
        byType: typeMap,
        topPages,
      },
    });
  } catch (error) {
    if (isTransientDbError(error)) {
      console.error('[api/admin/data] GET: database temporarily unavailable:', error);
      return NextResponse.json(
        { error: 'The database is temporarily unavailable. Please retry.', code: 'DB_UNAVAILABLE' },
        { status: 503, headers: { 'Retry-After': '5', 'X-Db-Unavailable': '1' } }
      );
    }
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
