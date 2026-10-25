// Where each guided-tour step points.
//
// Only the structure lives here — which page, which anchor, which dashboard
// tab. The wording lives in the i18n dictionary under `tour.steps.<key>`.
// Splitting them means an anchor is written down once instead of being
// duplicated into both the French and the English dictionary, where the two
// copies would eventually drift apart.

import type { Dict } from '@/lib/i18n';
import type { PageId } from '@/lib/route';

/**
 * Step keys are checked against the dictionary: adding a step without adding
 * its text in fr.ts (and therefore en.ts, which is typed as `Dict`) is a
 * compile error rather than a blank tooltip.
 */
export type TourStepKey = keyof Dict['tour']['steps'];

/** Dashboard tabs, mirroring the values of the Tabs in admin.tsx. */
export type AdminTab = 'inquiries' | 'products' | 'news' | 'content';

export type TourId = 'public' | 'admin-login' | 'admin';

export interface TourStep {
  key: TourStepKey;
  /** Value of the target's `data-tour` attribute. Omitted = a centred card. */
  anchor?: string;
  /** Visit this page before looking for the anchor. */
  page?: PageId;
  /** Select this dashboard tab before looking for the anchor. */
  tab?: AdminTab;
  placement?: 'top' | 'bottom';
}

export const TOURS: Record<TourId, TourStep[]> = {
  // The public tour walks across pages: the overlay navigates, then waits for
  // the anchor to appear in the newly rendered page.
  public: [
    { key: 'nav', anchor: 'nav' },
    { key: 'hero', anchor: 'hero', page: 'home' },
    { key: 'homeProducts', anchor: 'home-products', page: 'home' },
    { key: 'products', anchor: 'products-list', page: 'products' },
    { key: 'sustainability', anchor: 'sustainability-intro', page: 'sustainability' },
    { key: 'training', anchor: 'training-intro', page: 'training' },
    { key: 'news', anchor: 'news-list', page: 'news' },
    { key: 'contactForm', anchor: 'contact-form', page: 'contact' },
    { key: 'footerContact', anchor: 'footer-contact', page: 'contact', placement: 'top' },
  ],

  // Admin tour happens only after authenticated into dashboard; no tour on passcode screen.
  'admin-login': [],

  admin: [
    { key: 'adminHeader', anchor: 'admin-header' },
    { key: 'adminTabs', anchor: 'admin-tabs' },
    { key: 'adminInquiries', anchor: 'admin-inquiries', tab: 'inquiries' },
    { key: 'adminProducts', anchor: 'admin-products', tab: 'products' },
    { key: 'adminNews', anchor: 'admin-news', tab: 'news' },
    { key: 'adminContent', anchor: 'admin-content', tab: 'content' },
    { key: 'adminSecurity', anchor: 'admin-security', tab: 'content' },
  ],
};
