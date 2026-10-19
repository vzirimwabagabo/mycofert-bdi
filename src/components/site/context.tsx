'use client';

import { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from 'react';
import { DEFAULT_LANG, getDict, isLang, type Dict, type Lang } from '@/lib/i18n';

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

/** Parse "#/en/products" or "#/admin" into a Route. */
export function parseHash(hash: string, fallbackLang: Lang): Route {
  const raw = hash.replace(/^#\/?/, '').replace(/\/+$/, '');
  if (raw === 'admin') return { page: 'admin', lang: fallbackLang, isAdmin: true };
  const parts = raw.split('/').filter(Boolean);
  let lang: Lang = fallbackLang;
  if (parts.length > 0 && isLang(parts[0])) {
    lang = parts[0];
    parts.shift();
  }
  const seg = parts[0] ?? 'home';
  const pageMap: Record<string, PageId> = {
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
  let page = pageMap[seg] ?? 'home';
  let slug: string | undefined;
  if (page === 'news' && parts[1]) {
    page = 'news-post';
    slug = parts[1];
  }
  return { page, lang, slug, isAdmin: false };
}

/** Build a hash URL. */
export function hrefFor(lang: Lang, page: PageId, slug?: string): string {
  if (page === 'admin') return '#/admin';
  if (page === 'home') return `#/${lang}`;
  if (page === 'news-post' && slug) return `#/${lang}/news/${slug}`;
  return `#/${lang}/${page}`;
}

function subscribeHash(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}
const getHashSnapshot = () => window.location.hash;
const getHashServer = () => '';

function subscribeNoop() {
  return () => {};
}
const getStoredLang = (): Lang => {
  try {
    const v = window.localStorage.getItem('mycofert-lang');
    return isLang(v) ? v : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
};
const getStoredLangServer = (): Lang => DEFAULT_LANG;

interface SiteCtx {
  route: Route;
  lang: Lang;
  t: Dict;
  navigate: (page: PageId, slug?: string) => void;
  setLang: (lang: Lang) => void;
}

const Ctx = createContext<SiteCtx | null>(null);

export function SiteProvider({ children }: { children: React.ReactNode }) {
  const hash = useSyncExternalStore(subscribeHash, getHashSnapshot, getHashServer);
  const storedLang = useSyncExternalStore(subscribeNoop, getStoredLang, getStoredLangServer);

  const route = parseHash(hash, storedLang);

  // Per-language document metadata + first-party analytics (external systems only).
  useEffect(() => {
    if (route.isAdmin) return;
    const t = getDict(route.lang);
    document.documentElement.lang = route.lang;
    if (route.page === 'news-post') {
      const post = t.news.items.find((p) => p.slug === route.slug);
      document.title = post ? `${post.title} — MYCOFERT Burundi` : `${t.news.title} — MYCOFERT Burundi`;
    } else {
      document.title = t.meta.title;
    }
    const controller = new AbortController();
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: `/${route.lang}/${route.page}`, lang: route.lang }),
      signal: controller.signal,
    }).catch(() => {});
    return () => controller.abort();
  }, [route.page, route.slug, route.lang, route.isAdmin]);

  const navigate = useCallback(
    (page: PageId, slug?: string) => {
      const target = hrefFor(route.lang, page, slug);
      if (window.location.hash !== target) {
        window.location.hash = target.slice(1);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [route.lang]
  );

  const setLang = useCallback(
    (next: Lang) => {
      try {
        window.localStorage.setItem('mycofert-lang', next);
      } catch {
        /* storage unavailable */
      }
      if (route.isAdmin) return;
      const target = hrefFor(next, route.page, route.slug);
      if (window.location.hash !== target) {
        window.location.hash = target.slice(1);
      }
    },
    [route.isAdmin, route.page, route.slug]
  );

  const t = getDict(route.lang);

  return <Ctx.Provider value={{ route, lang: route.lang, t, navigate, setLang }}>{children}</Ctx.Provider>;
}

export function useSite(): SiteCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSite must be used within SiteProvider');
  return ctx;
}
