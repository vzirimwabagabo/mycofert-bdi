// Public content endpoint — powers the website pages.
// Returns settings + published products/news; seeds an empty database on
// first call so the site always has content.

import { NextResponse } from 'next/server';
import { getPublicContent } from '@/lib/cms-server';

export async function GET() {
  try {
    const content = await getPublicContent();
    return NextResponse.json(content, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[api/content] GET failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
