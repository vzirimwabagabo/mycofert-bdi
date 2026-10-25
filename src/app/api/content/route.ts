// Public content endpoint — powers the website pages.
// Returns settings + published products/news; seeds an empty database on
// first call so the site always has content.

import { NextResponse } from 'next/server';
import { getContentHealth, getPublicContent } from '@/lib/cms-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const content = await getPublicContent();
    // X-Content-Degraded: 1 means these products/news/settings are the built-in
    // defaults, not the stored rows — the database read failed. The response is
    // still 200 (an outdated page beats a 500), so this header is the only
    // signal an uptime check can see.
    const headers: Record<string, string> = { 'Cache-Control': 'no-store' };
    if (getContentHealth().degraded) headers['X-Content-Degraded'] = '1';
    return NextResponse.json(content, { headers });
  } catch (error) {
    console.error('[api/content] GET failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
