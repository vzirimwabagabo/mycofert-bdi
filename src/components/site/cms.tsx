'use client';

// Content management provider for the public site.
//
// Hydration safety: the initial state is the built-in dictionary content —
// identical on the server and during the first client render. The database
// content is fetched in an effect AFTER hydration, so any difference is a
// normal post-hydration update, never a hydration mismatch.
//
// Fallback safety: if the fetch fails (offline DB, network error), the site
// simply keeps rendering the built-in dictionary content.

import { createContext, useContext, useEffect, useState } from 'react';
import type { Lang } from '@/lib/i18n';
import {
  DEFAULT_NEWS,
  DEFAULT_PRODUCTS,
  mergeSettings,
  type CmsContact,
  type CmsHome,
  type CmsNews,
  type CmsProduct,
  type CmsSettings,
  type IText,
} from '@/lib/cms-defaults';

interface CmsState {
  /** True once the database content has been applied (or a fetch completed). */
  ready: boolean;
  settings: CmsSettings;
  /** Published products, sorted for display. */
  products: CmsProduct[];
  /** Published news posts, newest first. */
  news: CmsNews[];
}

const CmsCtx = createContext<CmsState | null>(null);

function fallbackState(): CmsState {
  return {
    ready: false,
    settings: mergeSettings({}),
    products: DEFAULT_PRODUCTS,
    news: DEFAULT_NEWS,
  };
}

interface PublicContent {
  settings: Record<string, unknown>;
  products: CmsProduct[];
  news: CmsNews[];
}

export function CmsProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<CmsState>(fallbackState);

  useEffect(() => {
    let disposed = false;

    // Fetch the latest published content; ignore results after unmount.
    function refresh() {
      fetch('/api/content', { cache: 'no-store' })
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
        .then((json: PublicContent) => {
          if (disposed) return;
          setState({
            ready: true,
            settings: mergeSettings(json.settings ?? {}),
            products: Array.isArray(json.products) ? json.products : DEFAULT_PRODUCTS,
            news: Array.isArray(json.news) ? json.news : DEFAULT_NEWS,
          });
        })
        .catch((error: unknown) => {
          if ((error as Error)?.name === 'AbortError') return;
          // Keep current content — the site stays fully functional.
          if (!disposed) setState((prev) => ({ ...prev, ready: true }));
        });
    }

    refresh();

    // The site is a hash-routed SPA: navigating between pages does NOT reload
    // the document. Refetch on every hash navigation so the owner immediately
    // sees their saved edits when previewing the public pages.
    window.addEventListener('hashchange', refresh);
    return () => {
      disposed = true;
      window.removeEventListener('hashchange', refresh);
    };
  }, []);

  return <CmsCtx.Provider value={state}>{children}</CmsCtx.Provider>;
}

export function useCms(): CmsState {
  const ctx = useContext(CmsCtx);
  if (!ctx) throw new Error('useCms must be used within CmsProvider');
  return ctx;
}

/** Resolve a bilingual text in the current language, with a safe fallback. */
export function pick(text: IText, lang: Lang): string {
  const value = lang === 'en' ? text.en || text.fr : text.fr || text.en;
  return value;
}

/** Contact details resolved for links (phones / WhatsApp). */
export function useContact(): CmsContact {
  return useCms().settings.contact;
}

export type { CmsContact, CmsHome, CmsNews, CmsProduct };
