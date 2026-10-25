// Server-side helpers for the content management system.
// Used by /api/content (public) and /api/admin/content (token-protected).

import { db } from '@/lib/db';
import { withDbRetry } from '@/lib/db-retry';
import type { NewsPost, Product } from '@prisma/client';
import {
  DEFAULT_NEWS,
  DEFAULT_PRODUCTS,
  SETTING_KEYS,
  linesToList,
  mergeSettings,
  paragraphsToList,
  type CmsNews,
  type CmsProduct,
  type CmsSettings,
} from '@/lib/cms-defaults';

const SEED_FLAG_KEY = 'seeded';

/**
 * Populate an empty database with the built-in default content so the owner
 * starts from a pre-filled dashboard instead of blank forms. Runs at most
 * once per database (guarded by a "seeded" flag row).
 */
export async function ensureSeeded(): Promise<void> {
  try {
    const flag = await db.siteSetting.findUnique({ where: { key: SEED_FLAG_KEY } });
    if (flag) return;

    const [productCount, newsCount] = await Promise.all([db.product.count(), db.newsPost.count()]);

    if (productCount === 0) {
      for (const p of DEFAULT_PRODUCTS) {
        await db.product.create({
          data: {
            slug: p.slug,
            sortOrder: p.sortOrder,
            published: true,
            imageKey: p.imageKey,
            nameFr: p.name.fr,
            nameEn: p.name.en,
            taglineFr: p.tagline.fr,
            taglineEn: p.tagline.en,
            descFr: p.description.fr,
            descEn: p.description.en,
            pointsFr: p.points.fr.join('\n'),
            pointsEn: p.points.en.join('\n'),
            formatsFr: p.formats.fr,
            formatsEn: p.formats.en,
          },
        });
      }
    }

    if (newsCount === 0) {
      for (const n of DEFAULT_NEWS) {
        await db.newsPost.create({
          data: {
            slug: n.slug,
            published: true,
            imageKey: n.imageKey,
            dateFr: n.date.fr,
            dateEn: n.date.en,
            titleFr: n.title.fr,
            titleEn: n.title.en,
            excerptFr: n.excerpt.fr,
            excerptEn: n.excerpt.en,
            bodyFr: n.body.fr.join('\n\n'),
            bodyEn: n.body.en.join('\n\n'),
            createdAt: new Date(n.createdAt),
          },
        });
      }
    }

    await db.siteSetting.create({
      data: { key: SEED_FLAG_KEY, value: JSON.stringify({ at: new Date().toISOString() }) },
    });
  } catch (error) {
    // Best-effort: a concurrent request may have seeded already; never break the page.
    console.error('[cms-server] ensureSeeded failed:', error);
  }
}

// ---------------------------------------------------------------------------
// Row -> API DTO transformers (compact bilingual shape for the frontend)
// ---------------------------------------------------------------------------

export function productDto(p: Product): CmsProduct {
  return {
    id: p.id,
    slug: p.slug,
    sortOrder: p.sortOrder,
    published: p.published,
    imageKey: p.imageKey,
    imageUrl: p.imageUrl,
    name: { fr: p.nameFr, en: p.nameEn },
    tagline: { fr: p.taglineFr, en: p.taglineEn },
    description: { fr: p.descFr, en: p.descEn },
    points: { fr: linesToList(p.pointsFr), en: linesToList(p.pointsEn) },
    formats: { fr: p.formatsFr, en: p.formatsEn },
  };
}

export function newsDto(n: NewsPost): CmsNews {
  return {
    id: n.id,
    slug: n.slug,
    published: n.published,
    imageKey: n.imageKey,
    imageUrl: n.imageUrl,
    date: { fr: n.dateFr, en: n.dateEn },
    title: { fr: n.titleFr, en: n.titleEn },
    excerpt: { fr: n.excerptFr, en: n.excerptEn },
    body: { fr: paragraphsToList(n.bodyFr), en: paragraphsToList(n.bodyEn) },
    createdAt: n.createdAt.toISOString(),
  };
}

/** Turn SiteSetting rows into the raw settings object (broken JSON is skipped). */
function parseSettingsRows(rows: { key: string; value: string }[]): Record<string, unknown> {
  const raw: Record<string, unknown> = {};
  for (const row of rows) {
    try {
      raw[row.key] = JSON.parse(row.value);
    } catch {
      /* ignore broken rows — defaults apply */
    }
  }
  return raw;
}

/**
 * Timestamp of the last public-content read that fell back to built-in content.
 * Null while the database is answering.
 *
 * getPublicContent() keeps serving built-in content when the database is
 * unreachable — an outdated page beats a 500 — but that trade-off must never be
 * invisible: an outage would otherwise look like a healthy page quietly showing
 * the wrong prices and products. The failure is recorded here so that
 * /api/content (response header) and /api/health?deep=1 can advertise it.
 */
let contentFallbackAt: string | null = null;

/** Whether the public site is currently being served from built-in fallback content. */
export function getContentHealth(): { degraded: boolean; lastFallbackAt: string | null } {
  return { degraded: contentFallbackAt !== null, lastFallbackAt: contentFallbackAt };
}

/** Public payload: settings + published products/news only. */
export async function getPublicContent() {
  try {
    await ensureSeeded();
    // Batched into one round trip: the pool holds a single connection, so three
    // separate queries would queue and each pay its own network round trip.
    const [settingRows, products, news] = await withDbRetry(
      () =>
        db.$transaction([
          db.siteSetting.findMany({ where: { key: { in: SETTING_KEYS } } }),
          db.product.findMany({
            where: { published: true },
            orderBy: [{ sortOrder: 'asc' }, { nameFr: 'asc' }],
          }),
          db.newsPost.findMany({ where: { published: true }, orderBy: { createdAt: 'desc' } }),
        ]),
      'public content'
    );
    const settings: CmsSettings = mergeSettings(parseSettingsRows(settingRows));
    contentFallbackAt = null;
    return { settings, products: products.map(productDto), news: news.map(newsDto) };
  } catch (error) {
    contentFallbackAt = new Date().toISOString();
    console.error(
      '[cms-server] ⚠️  SERVING PLACEHOLDER CONTENT: the database read failed, so public pages ' +
        'are showing built-in defaults instead of the stored products/news/settings. ' +
        'The site looks healthy but the data on it is NOT the data in the database.',
      error
    );
    return {
      settings: mergeSettings({}),
      products: DEFAULT_PRODUCTS,
      news: DEFAULT_NEWS,
    };
  }
}

/** Admin payload: everything, including unpublished items. */
export async function getAdminContent() {
  await ensureSeeded();
  const [settingRows, products, news] = await withDbRetry(
    () =>
      db.$transaction([
        db.siteSetting.findMany({ where: { key: { in: SETTING_KEYS } } }),
        db.product.findMany({ orderBy: [{ sortOrder: 'asc' }, { nameFr: 'asc' }] }),
        db.newsPost.findMany({ orderBy: { createdAt: 'desc' } }),
      ]),
    'admin content'
  );
  const settings: CmsSettings = mergeSettings(parseSettingsRows(settingRows));
  return { settings, products: products.map(productDto), news: news.map(newsDto) };
}
