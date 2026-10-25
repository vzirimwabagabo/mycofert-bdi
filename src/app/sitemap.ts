// Dynamic sitemap: static pages in both languages plus every published news
// post. Products have no dedicated pages yet (they live on /products), so
// they are not listed individually.

import type { MetadataRoute } from 'next';
import { getPublicContent } from '@/lib/cms-server';
import { hrefFor, type PageId } from '@/lib/route';
import { SITE_URL } from '@/lib/site';

export const dynamic = 'force-dynamic';

const STATIC_PAGES: {
  page: PageId;
  priority: number;
  changeFrequency: 'daily' | 'weekly' | 'monthly';
}[] = [
  { page: 'home', priority: 1.0, changeFrequency: 'weekly' },
  { page: 'products', priority: 0.9, changeFrequency: 'weekly' },
  { page: 'news', priority: 0.9, changeFrequency: 'daily' },
  { page: 'contact', priority: 0.8, changeFrequency: 'monthly' },
  { page: 'training', priority: 0.7, changeFrequency: 'monthly' },
  { page: 'about', priority: 0.6, changeFrequency: 'monthly' },
  { page: 'sustainability', priority: 0.6, changeFrequency: 'monthly' },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const urls: MetadataRoute.Sitemap = [];
  for (const l of ['fr', 'en'] as const) {
    for (const p of STATIC_PAGES) {
      urls.push({
        url: SITE_URL + hrefFor(l, p.page),
        changeFrequency: p.changeFrequency,
        priority: p.priority,
      });
    }
  }

  try {
    const { news } = await getPublicContent();
    for (const l of ['fr', 'en'] as const) {
      for (const n of news) {
        urls.push({
          url: SITE_URL + hrefFor(l, 'news-post', n.slug),
          lastModified: new Date(n.createdAt),
          changeFrequency: 'monthly',
          priority: 0.5,
        });
      }
    }
  } catch {
    /* database unreachable — serve the static portion */
  }

  return urls;
}
