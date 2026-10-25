// Server page for every public URL. An optional catch-all keeps the URL
// structure (/fr, /en/products, /fr/news/slug, /admin) while rendering the
// same client shell the site has always used — now with server-side content
// and per-page metadata so search engines index real pages instead of a
// hash-routed single page.
//
// Content comes from the database on every request (force-dynamic): this is
// a CMS, and prerendering at build time would both freeze content and
// require a database during `next build`.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { getPublicContent } from '@/lib/cms-server';
import { DEFAULT_LANG, getDict, isLang, type Lang } from '@/lib/i18n';
import { hrefFor, parseSegments, type PageId } from '@/lib/route';
import { SITE_URL } from '@/lib/site';
import { SiteShell } from '@/components/site/shell';

export const dynamic = 'force-dynamic';

// Deduplicated across generateMetadata + the page render within a request.
const getContent = cache(getPublicContent);

interface PageProps {
  params: Promise<{ slug?: string[] }>;
}

function routeFromParams(segments: string[]) {
  // URL language wins; bare "/" defaults to French (the primary market) and
  // is canonicalized client-side to the visitor's stored preference.
  const fallback = isLang(segments[0]) ? (segments[0] as Lang) : DEFAULT_LANG;
  return parseSegments(segments, fallback);
}

const PAGE_TITLE_KEY: Record<Exclude<PageId, 'news-post' | 'admin'>, string> = {
  home: 'home',
  products: 'products',
  about: 'about',
  sustainability: 'sustainability',
  training: 'training',
  news: 'news',
  contact: 'contact',
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const route = routeFromParams(slug ?? []);
  if (!route || route.isAdmin) return { robots: { index: false, follow: false } };

  const t = getDict(route.lang);
  const navKey =
    route.page === 'news-post' ? 'news' : PAGE_TITLE_KEY[route.page as Exclude<PageId, 'news-post' | 'admin'>];
  const title = route.page === 'home' ? t.meta.title : `${t.nav[navKey as keyof typeof t.nav]}`;

  const alternates: Record<string, string> = {};
  for (const l of ['fr', 'en'] as const) {
    alternates[l] = SITE_URL + hrefFor(l, route.page, route.slug);
  }
  alternates['x-default'] = SITE_URL + hrefFor('fr', route.page, route.slug);

  // Give article pages their real title and a publication date.
  let description = t.meta.description;
  const other: Record<string, string> = {};
  if (route.page === 'news-post' && route.slug) {
    try {
      const post = (await getContent()).news.find((n) => n.slug === route.slug);
      if (post) {
        description = post.excerpt[route.lang] || description;
        other['article:published_time'] = post.createdAt;
      }
    } catch {
      /* metadata stays on defaults if the DB is unreachable */
    }
  }

  return {
    title,
    description,
    alternates: { canonical: SITE_URL + hrefFor(route.lang, route.page, route.slug), languages: alternates },
    other,
  };
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const route = routeFromParams(slug ?? []);
  if (!route) notFound();

  // The admin dashboard authenticates client-side and fetches its own
  // content — no public content is server-rendered for it.
  if (route.isAdmin) {
    return <SiteShell initialRoute={route} />;
  }

  const content = await getContent();

  // Dead news slugs are 404s, not the news listing in disguise.
  if (route.page === 'news-post' && !content.news.some((n) => n.slug === route.slug)) {
    notFound();
  }

  return <SiteShell initialRoute={route} initialContent={content} />;
}
