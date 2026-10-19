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

// ---------------------------------------------------------------------------
// External store for client-only routing state (window.location.hash + the
// stored language preference).
//
// Hydration safety: the snapshot is EMPTY on the server AND during the
// client's first (hydration) render, so the server HTML and the first client
// render always match exactly. Real browser state is adopted once AFTER
// hydration from a useEffect — any resulting difference is a normal
// post-hydration re-render, never a hydration mismatch. (Reading
// localStorage/location during the hydration render is the classic cause of
// "server rendered text didn't match the client" errors.)
// ---------------------------------------------------------------------------

const LANG_KEY = 'mycofert-lang';

interface ExtState {
  hash: string;
  storedLang: Lang | null;
}

const INITIAL_EXT_STATE: ExtState = { hash: '', storedLang: null };

let extState: ExtState = INITIAL_EXT_STATE;
const extListeners = new Set<() => void>();

function notifyExt() {
  extListeners.forEach((listener) => listener());
}

function readStoredLang(): Lang | null {
  try {
    const v = window.localStorage.getItem(LANG_KEY);
    return isLang(v) ? v : null;
  } catch {
    return null;
  }
}

/** Adopt real browser state into the store. Call from effects/handlers only. */
function syncExtState() {
  const hash = window.location.hash;
  const storedLang = readStoredLang();
  if (hash === extState.hash && storedLang === extState.storedLang) return;
  extState = { hash, storedLang };
  notifyExt();
}

function subscribeExt(cb: () => void) {
  extListeners.add(cb);
  return () => {
    extListeners.delete(cb);
  };
}
const getExtSnapshot = (): ExtState => extState;
const getExtServerSnapshot = (): ExtState => INITIAL_EXT_STATE;

interface SiteCtx {
  route: Route;
  lang: Lang;
  t: Dict;
  navigate: (page: PageId, slug?: string) => void;
  setLang: (lang: Lang) => void;
}

const Ctx = createContext<SiteCtx | null>(null);

export function SiteProvider({ children }: { children: React.ReactNode }) {
  const ext = useSyncExternalStore(subscribeExt, getExtSnapshot, getExtServerSnapshot);

  const route = parseHash(ext.hash, ext.storedLang ?? DEFAULT_LANG);

  // Adopt real hash + stored language AFTER hydration, then keep in sync.
  useEffect(() => {
    syncExtState();
    const onHash = () => syncExtState();
    window.addEventListener('hashchange', onHash);

    // Dedicated language URLs: promote hashes without a language segment
    // (bare "/") to an explicit #/fr or #/en URL — but never hijack #/admin.
    const raw = window.location.hash.replace(/^#\/?/, '').replace(/\/+$/, '');
    if (raw !== 'admin' && !isLang(raw.split('/')[0] ?? '')) {
      const lang = readStoredLang() ?? DEFAULT_LANG;
      window.location.replace(hrefFor(lang, 'home'));
    }

    return () => window.removeEventListener('hashchange', onHash);
  }, []);

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
        window.localStorage.setItem(LANG_KEY, next);
      } catch {
        /* storage unavailable */
      }
      if (route.isAdmin) {
        syncExtState(); // admin hash has no lang segment — apply via stored preference
        return;
      }
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
