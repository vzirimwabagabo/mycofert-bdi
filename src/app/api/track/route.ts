import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { LIMIT_TRACK, rateLimitRequest } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * Analytics beacon.
 *
 * Deliberately silent about failures — it runs on every page navigation, so a
 * non-2xx response would produce console noise for visitors. Rate limiting is
 * still enforced, but always answered with 200 so the client never retries.
 *
 * Retention: PageView rows older than PAGEVIEW_RETENTION_DAYS (default 365)
 * are pruned opportunistically, at most once per hour per instance, so the
 * table — and the dashboard aggregates over it — stay bounded.
 */
const RETENTION_DAYS = Number.parseInt(process.env.PAGEVIEW_RETENTION_DAYS ?? '365', 10);
let lastPruneAt = 0;

function pruneOldPageViews() {
  if (!Number.isFinite(RETENTION_DAYS) || RETENTION_DAYS <= 0) return;
  if (Date.now() - lastPruneAt < 3_600_000) return;
  lastPruneAt = Date.now();
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000);
  db.pageView
    .deleteMany({ where: { createdAt: { lt: cutoff } } })
    .then((n) => {
      if (n.count > 0) console.info(`[api/track] pruned ${n.count} page views older than ${RETENTION_DAYS}d`);
    })
    .catch((error) => console.error('[api/track] retention prune failed:', error));
}

export async function POST(req: NextRequest) {
  const limit = await rateLimitRequest(req, LIMIT_TRACK);
  if (!limit.allowed) return NextResponse.json({ ok: false }, { status: 200 });

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return NextResponse.json({ ok: false }, { status: 200 });

    const raw = (body as Record<string, unknown>).path;
    const path = typeof raw === 'string' ? raw.slice(0, 200) : '';
    const lang = (body as Record<string, unknown>).lang === 'en' ? 'en' : 'fr';

    // Reject empty paths and Next.js internal/asset noise so the table holds
    // only real page views. Stored as a path only — no IP, no user agent.
    if (!path || path.startsWith('/undefined') || path.startsWith('/_next') || path.includes('.')) {
      return NextResponse.json({ ok: false }, { status: 200 });
    }

    await db.pageView.create({ data: { path, lang } });
    pruneOldPageViews();
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error('[api/track] POST failed:', error);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
