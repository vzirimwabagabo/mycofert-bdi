'use client';

// Content management provider for the public site.
//
// Hydration safety: the initial state is either the content the SERVER
// rendered into the page (initialContent prop — content is in the first-paint
// HTML, which is what crawlers and visitors on slow networks see) or, when
// absent (e.g. /admin), the built-in dictionary defaults — identical on the
// server and during the first client render either way.
//
// Fallback safety: if a refresh fails (offline DB, network error), the site
// simply keeps rendering whatever content it already has.

import { createContext, useContext, useEffect, useState } from 'react';
import type { Lang } from '@/lib/i18n';
import { onPathChange } from './context';
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
  /** True once database content has been applied (initialContent or a fetch). */
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

export interface PublicContent {
  settings: CmsSettings;
  products: CmsProduct[];
  news: CmsNews[];
}

export function CmsProvider({
  children,
  initialContent,
}: {
  children: React.ReactNode;
  /** Content fetched server-side alongside the page; skipped when absent. */
  initialContent?: PublicContent;
}) {
  const [state, setState] = useState<CmsState>(() =>
    initialContent
      ? {
          ready: true,
          settings: mergeSettings(initialContent.settings ?? {}),
          products: Array.isArray(initialContent.products) ? initialContent.products : DEFAULT_PRODUCTS,
          news: Array.isArray(initialContent.news) ? initialContent.news : DEFAULT_NEWS,
        }
      : fallbackState()
  );
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
        .catch(() => {
          // Keep current content — the site stays fully functional.
          if (!disposed) setState((prev) => ({ ...prev, ready: true }));
        });
    }

    // The server already delivered fresh content with this page; only fetch
    // immediately when we started from dictionary fallbacks.
    if (!initialContent) refresh();

    // Navigation is client-side (pushState): re-fetch on every path change
    // so the owner immediately sees saved edits when previewing public pages.
    const off = onPathChange(refresh);
    return () => {
      disposed = true;
      off();
    };
  }, [initialContent]);

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
