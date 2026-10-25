// URL routing model, shared by the server (App Router page) and the client
// (SiteProvider). Pure functions only — no React, no window — so both sides
// parse identical URLs into identical routes.
//
// URLs are real paths with a language prefix, so every page is indexable:
//   /fr            home (French)
//   /en/products   products (English)
//   /fr/news/slug  a news post
//   /admin         the admin dashboard (no language segment)

import { isLang, type Lang } from '@/lib/i18n';

export type PageId =
  | 'home'
  | 'products'
  | 'about'
  | 'sustainability'
  | 'training'
  | 'news'
  | 'news-post'
  | 'contact'
  | 'admin';

export interface Route {
  page: PageId;
  lang: Lang;
  slug?: string; // news post slug
  isAdmin: boolean;
}

/** FR and EN segment aliases -> canonical page id. */
const PAGE_MAP: Record<string, PageId> = {
  home: 'home',
  produits: 'products',
  products: 'products',
  'a-propos': 'about',
  about: 'about',
  durabilite: 'sustainability',
  sustainability: 'sustainability',
  formation: 'training',
  training: 'training',
  actualites: 'news',
  news: 'news',
  contact: 'contact',
};

/**
 * Parse URL path segments (["fr","products"], ["admin"], []) into a Route.
 * Returns null for paths that are not valid routes — the server renders 404.
 */
export function parseSegments(segments: readonly string[], fallbackLang: Lang): Route | null {
  const segs = segments.filter((s) => s.length > 0);
  if (segs.length === 0) return { page: 'home', lang: fallbackLang, isAdmin: false };

  if (segs[0] === 'admin') {
    return segs.length === 1 ? { page: 'admin', lang: fallbackLang, isAdmin: true } : null;
  }

  let lang = fallbackLang;
  if (isLang(segs[0])) {
    lang = segs[0];
    segs.shift();
  }

  const seg = segs[0] ?? 'home';
  const page = PAGE_MAP[seg];
  if (!page) return null;

  if (page === 'news') {
    if (segs.length === 1) return { page: 'news', lang, isAdmin: false };
    if (segs.length === 2) return { page: 'news-post', lang, slug: segs[1], isAdmin: false };
    return null;
  }

  if (segs.length > 1) return null;
  return { page, lang, isAdmin: false };
}

/** Client-side helper: parse a pathname like "/en/products". */
export function parsePath(pathname: string, fallbackLang: Lang): Route | null {
  return parseSegments(pathname.split('/'), fallbackLang);
}

/** Build the URL path for a route. */
export function hrefFor(lang: Lang, page: PageId, slug?: string): string {
  if (page === 'admin') return '/admin';
  if (page === 'home') return `/${lang}`;
  if (page === 'news-post' && slug) return `/${lang}/news/${slug}`;
  return `/${lang}/${page}`;
}
