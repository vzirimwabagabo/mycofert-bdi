'use client';

// Site routing state. The URL is the source of truth (real paths, no hash):
// the server renders the initial route into the HTML, and after hydration a
// client-side external store tracks pathname changes driven by pushState /
// popstate from navigate() and setLang().

import { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from 'react';
import { DEFAULT_LANG, getDict, type Dict, type Lang } from '@/lib/i18n';
import { hrefFor, parsePath, type PageId, type Route } from '@/lib/route';

export type { PageId, Route };
export { hrefFor };

const LANG_KEY = 'mycofert-lang';

// ---------------------------------------------------------------------------
// External store for client-only routing state (window.location.pathname +
// the stored language preference).
//
// Hydration safety: the snapshot is EMPTY on the server AND during the
// client's first (hydration) render — SiteProvider falls back to the
// server-derived initialRoute, so server HTML and first client render match
// exactly. Real browser state is adopted once AFTER hydration from a
// useEffect; any resulting difference is a normal post-hydration re-render,
// never a hydration mismatch.
// ---------------------------------------------------------------------------

interface ExtState {
  path: string;
  storedLang: Lang | null;
}

const INITIAL_EXT_STATE: ExtState = { path: '', storedLang: null };

let extState: ExtState = INITIAL_EXT_STATE;
const extListeners = new Set<() => void>();

function notifyExt() {
  extListeners.forEach((listener) => listener());
}

function readStoredLang(): Lang | null {
  try {
    const v = window.localStorage.getItem(LANG_KEY);
    return isLangStored(v);
  } catch {
    return null;
  }
}

function isLangStored(v: string | null): Lang | null {
  return v === 'fr' || v === 'en' ? v : null;
}

/** Adopt real browser state into the store. Call from effects/handlers only. */
function syncExtState() {
  const path = window.location.pathname;
  const storedLang = readStoredLang();
  if (path === extState.path && storedLang === extState.storedLang) return;
  extState = { path, storedLang };
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

/**
 * Subscribe to client-side path changes (pushState from navigate()/setLang()
 * and popstate). Used by CmsProvider to refresh content on navigation.
 */
export function onPathChange(cb: () => void): () => void {
  extListeners.add(cb);
  return () => {
    extListeners.delete(cb);
  };
}

interface SiteCtx {
  route: Route;
  lang: Lang;
  t: Dict;
  navigate: (page: PageId, slug?: string) => void;
  setLang: (lang: Lang) => void;
}

const Ctx = createContext<SiteCtx | null>(null);

export function SiteProvider({
  children,
  initialRoute,
}: {
  children: React.ReactNode;
  /** Route parsed on the server from the request URL — keeps first paint and hydration correct. */
  initialRoute: Route;
}) {
  const ext = useSyncExternalStore(subscribeExt, getExtSnapshot, getExtServerSnapshot);

  const route = ext.path
    ? (parsePath(ext.path, ext.storedLang ?? initialRoute.lang) ?? initialRoute)
    : initialRoute;

  // Adopt the real URL + stored language AFTER hydration, then stay in sync
  // with the browser Back/Forward buttons.
  useEffect(() => {
    syncExtState();
    const onPop = () => syncExtState();
    window.addEventListener('popstate', onPop);

    // Canonicalize a bare "/" visit to an explicit language path, preferring
    // the visitor's stored choice. replaceState — no reload, no history entry.
    if (window.location.pathname === '/') {
      const lang = readStoredLang() ?? DEFAULT_LANG;
      window.history.replaceState({}, '', hrefFor(lang, 'home'));
      syncExtState();
    }

    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Per-language document metadata + first-party analytics.
  // Note: news-post pages set their own document title (see NewsPostPage),
  // because parent effects run after child effects and would overwrite it.
  useEffect(() => {
    if (route.isAdmin) return;
    const t = getDict(route.lang);
    document.documentElement.lang = route.lang;
    if (route.page !== 'news-post') {
      document.title = t.meta.title;
    }
    const path = hrefFor(route.lang, route.page, route.slug);
    if (path === '/') return; // about to be canonicalized to a language path
    const controller = new AbortController();
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, lang: route.lang }),
      signal: controller.signal,
    }).catch(() => {});
    return () => controller.abort();
  }, [route.page, route.slug, route.lang, route.isAdmin]);

  const navigate = useCallback(
    (page: PageId, slug?: string) => {
      const target = hrefFor(route.lang, page, slug);
      if (window.location.pathname !== target) {
        window.history.pushState({}, '', target);
        syncExtState();
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
        syncExtState(); // admin path has no lang segment — apply via stored preference
        return;
      }
      const target = hrefFor(next, route.page, route.slug);
      if (window.location.pathname !== target) {
        window.history.pushState({}, '', target);
        syncExtState();
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
