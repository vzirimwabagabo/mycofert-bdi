// Liveness / readiness probe for the load balancer.
//
// Two distinct questions:
//   /api/health        — is this instance alive? Cheap, no dependencies.
//   /api/health?deep=1 — is this instance ready to serve? Checks the database.
//
// The LB should use the cheap probe for liveness (so a database blip does not
// trigger a restart loop across every instance) and the deep probe for
// readiness (so a broken instance stops receiving traffic).

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const deep = url.searchParams.get('deep') === '1';

  const payload: Record<string, unknown> = {
    status: 'ok',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  };

  if (deep) {
    const started = Date.now();
    try {
      await db.$queryRaw`SELECT 1`;
      payload.database = { status: 'ok', latencyMs: Date.now() - started };
    } catch (error) {
      console.error('[api/health] database check failed:', error);
      payload.status = 'degraded';
      payload.database = { status: 'error' };
      return NextResponse.json(payload, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
  }

  return NextResponse.json(payload, { status: 200, headers: { 'Cache-Control': 'no-store' } });
}
