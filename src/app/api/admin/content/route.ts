// Admin content management API — create / update / delete products and news,
// and save editable site settings. Protected by the same admin token as
// /api/admin/data (passcode -> base64 token via /api/admin/auth).

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { getAdminContent, newsDto, productDto } from '@/lib/cms-server';
import { SETTING_KEYS, slugify } from '@/lib/cms-defaults';

const PASSCODE = process.env.ADMIN_PASSCODE || 'mycofert2026';

function isValidToken(token: string | null): boolean {
  if (!token) return false;
  try {
    return Buffer.from(token, 'base64').toString('utf8') === PASSCODE;
  } catch {
    return false;
  }
}

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

// --- field helpers ----------------------------------------------------------

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

/** Build a Prisma update payload from a partial product form object. */
function productUpdateData(d: Record<string, unknown>): Prisma.ProductUpdateInput {
  const data: Prisma.ProductUpdateInput = {};
  const slug = slugify(str(d.slug, 60));
  if (slug) data.slug = slug;
  if (typeof d.sortOrder === 'number' && Number.isFinite(d.sortOrder)) {
    data.sortOrder = Math.trunc(d.sortOrder);
  }
  if (typeof d.published === 'boolean') data.published = d.published;
  const imageKey = str(d.imageKey, 40);
  if (imageKey) data.imageKey = imageKey;
  const nameFr = str(d.nameFr, 200);
  if (nameFr) {
    data.nameFr = nameFr;
    data.nameEn = str(d.nameEn, 200) || nameFr;
  } else if (typeof d.nameEn === 'string' && d.nameEn.trim()) {
    data.nameEn = d.nameEn.trim().slice(0, 200);
  }
  if (typeof d.taglineFr === 'string') data.taglineFr = str(d.taglineFr, 300);
  if (typeof d.taglineEn === 'string') data.taglineEn = str(d.taglineEn, 300);
  if (typeof d.descFr === 'string') data.descFr = str(d.descFr, 5000);
  if (typeof d.descEn === 'string') data.descEn = str(d.descEn, 5000);
  if (typeof d.pointsFr === 'string') data.pointsFr = str(d.pointsFr, 5000);
  if (typeof d.pointsEn === 'string') data.pointsEn = str(d.pointsEn, 5000);
  if (typeof d.formatsFr === 'string') data.formatsFr = str(d.formatsFr, 500);
  if (typeof d.formatsEn === 'string') data.formatsEn = str(d.formatsEn, 500);
  return data;
}

/** Build a Prisma update payload from a partial news form object. */
function newsUpdateData(d: Record<string, unknown>): Prisma.NewsPostUpdateInput {
  const data: Prisma.NewsPostUpdateInput = {};
  const slug = slugify(str(d.slug, 60));
  if (slug) data.slug = slug;
  if (typeof d.published === 'boolean') data.published = d.published;
  const imageKey = str(d.imageKey, 40);
  if (imageKey) data.imageKey = imageKey;
  if (typeof d.dateFr === 'string') data.dateFr = str(d.dateFr, 60);
  if (typeof d.dateEn === 'string') data.dateEn = str(d.dateEn, 60);
  const titleFr = str(d.titleFr, 200);
  if (titleFr) {
    data.titleFr = titleFr;
    data.titleEn = str(d.titleEn, 200) || titleFr;
  } else if (typeof d.titleEn === 'string' && d.titleEn.trim()) {
    data.titleEn = d.titleEn.trim().slice(0, 200);
  }
  if (typeof d.excerptFr === 'string') data.excerptFr = str(d.excerptFr, 1000);
  if (typeof d.excerptEn === 'string') data.excerptEn = str(d.excerptEn, 1000);
  if (typeof d.bodyFr === 'string') data.bodyFr = str(d.bodyFr, 40000);
  if (typeof d.bodyEn === 'string') data.bodyEn = str(d.bodyEn, 40000);
  return data;
}

// --- handlers ---------------------------------------------------------------

export async function GET(req: NextRequest) {
  if (!isValidToken(req.headers.get('x-admin-token'))) return unauthorized();
  try {
    const content = await getAdminContent();
    return NextResponse.json(content, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[api/admin/content] GET failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isValidToken(req.headers.get('x-admin-token'))) return unauthorized();
  try {
    const body = await req.json();
    const kind = body.kind;
    const d: Record<string, unknown> = typeof body.data === 'object' && body.data ? body.data : {};

    if (kind === 'product') {
      const nameFr = str(d.nameFr, 200);
      if (!nameFr) {
        return NextResponse.json({ error: 'Product name (FR) is required' }, { status: 400 });
      }
      const slug = slugify(str(d.slug, 60)) || slugify(nameFr);
      if (!slug) {
        return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
      }
      const created = await db.product.create({
        data: {
          slug,
          sortOrder:
            typeof d.sortOrder === 'number' && Number.isFinite(d.sortOrder) ? Math.trunc(d.sortOrder) : 0,
          published: d.published !== false,
          imageKey: str(d.imageKey, 40) || 'fresh',
          nameFr,
          nameEn: str(d.nameEn, 200) || nameFr,
          taglineFr: str(d.taglineFr, 300),
          taglineEn: str(d.taglineEn, 300),
          descFr: str(d.descFr, 5000),
          descEn: str(d.descEn, 5000),
          pointsFr: str(d.pointsFr, 5000),
          pointsEn: str(d.pointsEn, 5000),
          formatsFr: str(d.formatsFr, 500),
          formatsEn: str(d.formatsEn, 500),
        },
      });
      return NextResponse.json({ ok: true, product: productDto(created) });
    }

    if (kind === 'news') {
      const titleFr = str(d.titleFr, 200);
      if (!titleFr) {
        return NextResponse.json({ error: 'Article title (FR) is required' }, { status: 400 });
      }
      const slug = slugify(str(d.slug, 60)) || slugify(titleFr);
      if (!slug) {
        return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
      }
      const created = await db.newsPost.create({
        data: {
          slug,
          published: d.published !== false,
          imageKey: str(d.imageKey, 40) || 'training',
          dateFr: str(d.dateFr, 60),
          dateEn: str(d.dateEn, 60),
          titleFr,
          titleEn: str(d.titleEn, 200) || titleFr,
          excerptFr: str(d.excerptFr, 1000),
          excerptEn: str(d.excerptEn, 1000),
          bodyFr: str(d.bodyFr, 40000),
          bodyEn: str(d.bodyEn, 40000),
        },
      });
      return NextResponse.json({ ok: true, news: newsDto(created) });
    }

    return NextResponse.json({ error: 'Invalid kind' }, { status: 400 });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json(
        { error: 'duplicate-slug' },
        { status: 409 },
      );
    }
    console.error('[api/admin/content] POST failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!isValidToken(req.headers.get('x-admin-token'))) return unauthorized();
  try {
    const body = await req.json();
    const kind = body.kind;
    const d: Record<string, unknown> = typeof body.data === 'object' && body.data ? body.data : {};
    const id = str(body.id, 64);

    if (kind === 'product') {
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
      await db.product.update({ where: { id }, data: productUpdateData(d) });
      return NextResponse.json({ ok: true });
    }

    if (kind === 'news') {
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
      await db.newsPost.update({ where: { id }, data: newsUpdateData(d) });
      return NextResponse.json({ ok: true });
    }

    if (kind === 'setting') {
      const key = str(body.key, 40);
      const value = body.value;
      if (!(SETTING_KEYS as string[]).includes(key) || !value || typeof value !== 'object' || Array.isArray(value)) {
        return NextResponse.json({ error: 'Invalid setting payload' }, { status: 400 });
      }
      await db.siteSetting.upsert({
        where: { key },
        update: { value: JSON.stringify(value) },
        create: { key, value: JSON.stringify(value) },
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Invalid kind' }, { status: 400 });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: 'duplicate-slug' }, { status: 409 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    console.error('[api/admin/content] PATCH failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!isValidToken(req.headers.get('x-admin-token'))) return unauthorized();
  try {
    const { searchParams } = new URL(req.url);
    const kind = searchParams.get('kind');
    const id = (searchParams.get('id') ?? '').slice(0, 64);
    if (!id || (kind !== 'product' && kind !== 'news')) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
    if (kind === 'product') {
      await db.product.delete({ where: { id } });
    } else {
      await db.newsPost.delete({ where: { id } });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    console.error('[api/admin/content] DELETE failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
