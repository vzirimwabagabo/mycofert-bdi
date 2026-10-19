import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const ALLOWED_TYPES = ['product', 'bulk', 'fertilizer', 'training', 'partnership'];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const type = typeof body.type === 'string' ? body.type : '';
    const product = typeof body.product === 'string' ? body.product : '';
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const lang = body.lang === 'en' ? 'en' : 'fr';

    if (!name || !phone || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(type)) {
      return NextResponse.json({ error: 'Invalid inquiry type' }, { status: 400 });
    }
    if (phone.replace(/\D/g, '').length < 7) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 });
    }

    const inquiry = await db.inquiry.create({
      data: {
        name: name.slice(0, 200),
        phone: phone.slice(0, 50),
        email: email ? email.slice(0, 200) : null,
        type,
        product: product ? product.slice(0, 120) : null,
        message: message.slice(0, 4000),
        lang,
      },
    });

    return NextResponse.json({ ok: true, id: inquiry.id });
  } catch (error) {
    console.error('[api/inquiries] POST failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
