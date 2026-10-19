// Shared content-management types + bilingual default content.
//
// This module is the single source of truth for the shape of CMS content.
// It is used in three places:
//   1. Server seeding  (/api/content auto-seed on an empty database)
//   2. Client fallback (the site renders dictionary defaults while the
//      database has no content yet — the site can never look broken)
//   3. Admin dashboard (form field types)
//
// All editable text is bilingual: IText = { fr, en }.

import { SITE } from '@/lib/site';
import { fr } from '@/lib/i18n/fr';
import { en } from '@/lib/i18n/en';

export interface IText {
  fr: string;
  en: string;
}

/** Preset image library (public/images/*.png) the owner can pick from. */
export const IMAGE_LIBRARY = [
  'fresh',
  'dried',
  'powder',
  'packaged',
  'substrate',
  'fertilizer',
  'sustainability',
  'training',
  'hero',
] as const;

export type ImageKey = (typeof IMAGE_LIBRARY)[number];

export function imageSrc(imageKey: string): string {
  return `/images/${(IMAGE_LIBRARY as readonly string[]).includes(imageKey) ? imageKey : 'fresh'}.png`;
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export interface CmsProduct {
  id: string;
  slug: string;
  sortOrder: number;
  published: boolean;
  imageKey: string;
  name: IText;
  tagline: IText;
  description: IText;
  points: { fr: string[]; en: string[] };
  formats: IText;
}

// ---------------------------------------------------------------------------
// News
// ---------------------------------------------------------------------------

export interface CmsNews {
  id: string;
  slug: string;
  published: boolean;
  imageKey: string;
  date: IText;
  title: IText;
  excerpt: IText;
  body: { fr: string[]; en: string[] };
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Editable settings groups
// ---------------------------------------------------------------------------

export interface CmsContact {
  phones: { label: string; tel: string }[];
  whatsappNumber: string;
  email: string;
  city: string;
  country: string;
  hours: IText;
}

export interface CmsHome {
  heroBadge: IText;
  heroTitle: IText;
  heroSubtitle: IText;
  stat1: IText;
  stat2: IText;
  stat3: IText;
  ctaBandTitle: IText;
  ctaBandText: IText;
}

export interface CmsTraining {
  title: IText;
  subtitle: IText;
  intro: IText;
}

export interface CmsAbout {
  missionText: IText;
  visionText: IText;
}

export interface CmsSustainability {
  title: IText;
  subtitle: IText;
  cycleText: IText;
}

export interface CmsSettings {
  contact: CmsContact;
  home: CmsHome;
  training: CmsTraining;
  about: CmsAbout;
  sustainability: CmsSustainability;
}

export type SettingKey = keyof CmsSettings;
export const SETTING_KEYS: SettingKey[] = ['contact', 'home', 'training', 'about', 'sustainability'];

// ---------------------------------------------------------------------------
// Defaults (derived from the built-in dictionaries so the CMS starts pre-filled)
// ---------------------------------------------------------------------------

const it = (frText: string, enText: string): IText => ({ fr: frText, en: enText });

export const DEFAULT_SETTINGS: CmsSettings = {
  contact: {
    phones: SITE.phones.map((p) => ({ ...p })),
    whatsappNumber: SITE.whatsappNumber,
    email: SITE.email,
    city: SITE.city,
    country: SITE.country,
    hours: it(fr.common.hoursValue, en.common.hoursValue),
  },
  home: {
    heroBadge: it(fr.home.heroBadge, en.home.heroBadge),
    heroTitle: it(fr.home.heroTitle, en.home.heroTitle),
    heroSubtitle: it(fr.home.heroSubtitle, en.home.heroSubtitle),
    stat1: it(fr.home.heroStat1, en.home.heroStat1),
    stat2: it(fr.home.heroStat2, en.home.heroStat2),
    stat3: it(fr.home.heroStat3, en.home.heroStat3),
    ctaBandTitle: it(fr.home.ctaBandTitle, en.home.ctaBandTitle),
    ctaBandText: it(fr.home.ctaBandText, en.home.ctaBandText),
  },
  training: {
    title: it(fr.training.title, en.training.title),
    subtitle: it(fr.training.subtitle, en.training.subtitle),
    intro: it(fr.training.intro, en.training.intro),
  },
  about: {
    missionText: it(fr.about.missionText, en.about.missionText),
    visionText: it(fr.about.visionText, en.about.visionText),
  },
  sustainability: {
    title: it(fr.sustainability.title, en.sustainability.title),
    subtitle: it(fr.sustainability.subtitle, en.sustainability.subtitle),
    cycleText: it(fr.sustainability.cycleText, en.sustainability.cycleText),
  },
};

const NEWS_IMAGE_KEYS: Record<string, string> = {
  'formation-cohorte': 'training',
  'poudre-usage': 'powder',
  'substrat-engrais': 'fertilizer',
};

/** Staggered seed dates so the three default posts keep their original order. */
const NEWS_SEED_DATES = ['2026-10-01T09:00:00.000Z', '2026-09-01T09:00:00.000Z', '2026-08-01T09:00:00.000Z'];

export const DEFAULT_PRODUCTS: CmsProduct[] = fr.products.items.map((item, i) => ({
  id: item.id,
  slug: item.id,
  sortOrder: (i + 1) * 10,
  published: true,
  imageKey: item.id,
  name: it(item.name, en.products.items[i]?.name ?? item.name),
  tagline: it(item.tagline, en.products.items[i]?.tagline ?? ''),
  description: it(item.description, en.products.items[i]?.description ?? ''),
  points: {
    fr: [...item.points],
    en: [...(en.products.items[i]?.points ?? [])],
  },
  formats: it(item.formats, en.products.items[i]?.formats ?? ''),
}));

export const DEFAULT_NEWS: CmsNews[] = fr.news.items.map((post, i) => ({
  id: post.slug,
  slug: post.slug,
  published: true,
  imageKey: NEWS_IMAGE_KEYS[post.slug] ?? 'training',
  date: it(post.date, en.news.items[i]?.date ?? post.date),
  title: it(post.title, en.news.items[i]?.title ?? post.title),
  excerpt: it(post.excerpt, en.news.items[i]?.excerpt ?? ''),
  body: {
    fr: [...post.body],
    en: [...(en.news.items[i]?.body ?? [])],
  },
  createdAt: NEWS_SEED_DATES[i] ?? new Date().toISOString(),
}));

// ---------------------------------------------------------------------------
// Helpers shared by the API and the admin UI
// ---------------------------------------------------------------------------

/** "  a \n b \n" -> ["a", "b"] — one bullet per line. */
export function linesToList(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Paragraphs separated by one or more blank lines. */
export function paragraphsToList(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * Merge raw (partially saved) settings from the database over the defaults.
 * Each group is merged shallowly, so a saved group always wins field by field.
 */
export function mergeSettings(raw: Record<string, unknown>): CmsSettings {
  const pick = <K extends SettingKey>(key: K): CmsSettings[K] => {
    const r = raw[key];
    return r && typeof r === 'object' && !Array.isArray(r)
      ? ({ ...DEFAULT_SETTINGS[key], ...(r as object) } as CmsSettings[K])
      : DEFAULT_SETTINGS[key];
  };
  return {
    contact: pick('contact'),
    home: pick('home'),
    training: pick('training'),
    about: pick('about'),
    sustainability: pick('sustainability'),
  };
}
