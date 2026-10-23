import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { LIMIT_INQUIRIES, rateLimitRequest, rateLimitHeaders } from '@/lib/rate-limit';

const ALLOWED_TYPES = ['product', 'bulk', 'fertilizer', 'training', 'partnership'] as const;

/** Pragmatic email check — deliberately permissive, rejects obvious garbage only. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;

/** Strip control characters that have no place in stored text. */
function clean(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
}

export async function POST(req: NextRequest) {
  // Rate limit before touching the database.
  const limit = await rateLimitRequest(req, LIMIT_INQUIRIES);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many submissions. Please try again later.' },
      { status: 429, headers: rateLimitHeaders(limit) }
    );
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
    const b = body as Record<string, unknown>;

    // Honeypot: a field hidden from humans. Bots fill it in, so a non-empty
    // value means automated submission. Respond 200 so the bot believes it
    // succeeded and does not retry with a different strategy.
    if (typeof b.website === 'string' && b.website.trim() !== '') {
      console.warn('[api/inquiries] honeypot triggered — discarding submission');
      return NextResponse.json({ ok: true, id: null });
    }

    const name = typeof b.name === 'string' ? clean(b.name).slice(0, 200) : '';
    const phone = typeof b.phone === 'string' ? clean(b.phone).slice(0, 50) : '';
    const email = typeof b.email === 'string' ? clean(b.email).slice(0, 200) : '';
    const type = typeof b.type === 'string' ? b.type : '';
    const product = typeof b.product === 'string' ? clean(b.product).slice(0, 120) : '';
    const message = typeof b.message === 'string' ? clean(b.message).slice(0, 4000) : '';
    const lang = b.lang === 'en' ? 'en' : 'fr';

    if (!name || !phone || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (!(ALLOWED_TYPES as readonly string[]).includes(type)) {
      return NextResponse.json({ error: 'Invalid inquiry type' }, { status: 400 });
    }
    if (phone.replace(/\D/g, '').length < 7) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 });
    }
    // Email is optional, but when supplied it must look like an address —
    // otherwise a bad value lands in the dashboard and the CSV export.
    if (email && !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }
    if (name.length < 2 || message.length < 5) {
      return NextResponse.json({ error: 'Submission too short' }, { status: 400 });
    }

    const inquiry = await db.inquiry.create({
      data: {
        name,
        phone,
        email: email || null,
        type,
        product: product || null,
        message,
        lang,
      },
      // Return only the id — never echo the stored row back to an anonymous caller.
      select: { id: true },
    });

    return NextResponse.json({ ok: true, id: inquiry.id }, { status: 201 });
  } catch (error) {
    console.error('[api/inquiries] POST failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
