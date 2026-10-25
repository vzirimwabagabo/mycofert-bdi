// Admin content management API — create / update / delete products and news,
// and save editable site settings. Protected by signed admin tokens minted by
// /api/admin/auth.

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { isTransientDbError } from '@/lib/db-retry';
import { getAdminContent, newsDto, productDto } from '@/lib/cms-server';
import { IMAGE_LIBRARY, SETTING_KEYS, slugify } from '@/lib/cms-defaults';
import { ADMIN_TOKEN_HEADER, verifyRequest } from '@/lib/auth';
import { LIMIT_ADMIN_API, rateLimitRequest, rateLimitHeaders } from '@/lib/rate-limit';
import { isAllowedImageUrl } from '@/lib/image-url';

export const dynamic = 'force-dynamic';

/**
 * Authorise an admin request, with rate limiting.
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
    return NextResponse.json(
      { error: result.reason === 'expired' ? 'Session expired' : 'Unauthorized' },
      { status: 401, headers: result.reason === 'expired' ? { 'X-Session-Expired': '1' } : undefined }
    );
  }
  return null;
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

// --- field helpers ----------------------------------------------------------

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

/**
 * imageKey maps to a file under /public/images, so only library members are
 * accepted. An arbitrary value would silently fall back to 'fresh' at render
 * time while being stored verbatim, so reject it at the boundary instead.
 */
function imageKey(v: unknown, fallback: string): string {
  const candidate = str(v, 40);
  return (IMAGE_LIBRARY as readonly string[]).includes(candidate) ? candidate : fallback;
}

/**
 * Uploaded image URL. Only https URLs on the object-storage public base (or a
 * legacy res.cloudinary.com URL) are accepted — that is exactly what the CSP
 * img-src allows and what the upload flow produces, so a stored URL can never
 * point at an arbitrary host.
 * undefined = field absent, null/'' = cleared.
 */
function imageUrlField(v: unknown): { ok: true; value: string | null } | { ok: false } {
  if (v === undefined || v === null) return { ok: true, value: null };
  if (typeof v !== 'string') return { ok: false };
  const s = v.trim().slice(0, 1000);
  if (!s) return { ok: true, value: null };
  if (!isAllowedImageUrl(s)) return { ok: false };
  return { ok: true, value: s };
}

/** Build a Prisma update payload from a partial product form object. */
function productUpdateData(d: Record<string, unknown>, imageUrl?: string | null): Prisma.ProductUpdateInput {
  const data: Prisma.ProductUpdateInput = {};
  const slug = slugify(str(d.slug, 60));
  if (slug) data.slug = slug;
  if (typeof d.sortOrder === 'number' && Number.isFinite(d.sortOrder)) {
    data.sortOrder = Math.trunc(d.sortOrder);
  }
  if (typeof d.published === 'boolean') data.published = d.published;
  const key = str(d.imageKey, 40);
  if (key && (IMAGE_LIBRARY as readonly string[]).includes(key)) data.imageKey = key;
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
  if (imageUrl !== undefined) data.imageUrl = imageUrl;
  return data;
}

/** Build a Prisma update payload from a partial news form object. */
function newsUpdateData(d: Record<string, unknown>, imageUrl?: string | null): Prisma.NewsPostUpdateInput {
  const data: Prisma.NewsPostUpdateInput = {};
  const slug = slugify(str(d.slug, 60));
  if (slug) data.slug = slug;
  if (typeof d.published === 'boolean') data.published = d.published;
  const key = str(d.imageKey, 40);
  if (key && (IMAGE_LIBRARY as readonly string[]).includes(key)) data.imageKey = key;
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
  if (imageUrl !== undefined) data.imageUrl = imageUrl;
  return data;
}

// --- handlers ---------------------------------------------------------------

export async function GET(req: NextRequest) {
  const denied = await authorize(req);
  if (denied) return denied;
  try {
    const content = await getAdminContent();
    return NextResponse.json(content, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (isTransientDbError(error)) {
      console.error('[api/admin/content] GET: database temporarily unavailable:', error);
      return NextResponse.json(
        { error: 'The database is temporarily unavailable. Please retry.', code: 'DB_UNAVAILABLE' },
        { status: 503, headers: { 'Retry-After': '5', 'X-Db-Unavailable': '1' } }
      );
    }
    console.error('[api/admin/content] GET failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const denied = await authorize(req);
  if (denied) return denied;
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
      const img = imageUrlField(d.imageUrl);
      if (!img.ok) {
        return NextResponse.json({ error: 'Invalid image URL' }, { status: 400 });
      }
      const created = await db.product.create({
        data: {
          slug,
          sortOrder:
            typeof d.sortOrder === 'number' && Number.isFinite(d.sortOrder) ? Math.trunc(d.sortOrder) : 0,
          published: d.published !== false,
          imageKey: imageKey(d.imageKey, 'fresh'),
          imageUrl: img.value,
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
      const img = imageUrlField(d.imageUrl);
      if (!img.ok) {
        return NextResponse.json({ error: 'Invalid image URL' }, { status: 400 });
      }
      const created = await db.newsPost.create({
        data: {
          slug,
          published: d.published !== false,
          imageKey: imageKey(d.imageKey, 'training'),
          imageUrl: img.value,
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
  const denied = await authorize(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const kind = body.kind;
    const d: Record<string, unknown> = typeof body.data === 'object' && body.data ? body.data : {};
    const id = str(body.id, 64);

    if (kind === 'product') {
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
      const img = imageUrlField(d.imageUrl);
      if (!img.ok) return NextResponse.json({ error: 'Invalid image URL' }, { status: 400 });
      await db.product.update({ where: { id }, data: productUpdateData(d, img.value) });
      return NextResponse.json({ ok: true });
    }

    if (kind === 'news') {
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
      const img = imageUrlField(d.imageUrl);
      if (!img.ok) return NextResponse.json({ error: 'Invalid image URL' }, { status: 400 });
      await db.newsPost.update({ where: { id }, data: newsUpdateData(d, img.value) });
      return NextResponse.json({ ok: true });
    }

    if (kind === 'setting') {
      const key = str(body.key, 40);
      const value = body.value;
      if (!(SETTING_KEYS as string[]).includes(key) || !value || typeof value !== 'object' || Array.isArray(value)) {
        return NextResponse.json({ error: 'Invalid setting payload' }, { status: 400 });
      }
      // settings.home.heroImage is rendered as an <img src> on every page
      // load, so it must obey the same Cloudinary-only rule as item images.
      if (key === 'home') {
        const heroImage = (value as Record<string, unknown>).heroImage;
        if (typeof heroImage === 'string' && heroImage.trim() !== '' && !isAllowedImageUrl(heroImage.trim())) {
          return NextResponse.json({ error: 'Invalid hero image URL' }, { status: 400 });
        }
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
  const denied = await authorize(req);
  if (denied) return denied;
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
