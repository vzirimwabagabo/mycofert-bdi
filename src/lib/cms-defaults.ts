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
import { isAllowedImageUrl } from '@/lib/image-url';
import { fr } from '@/lib/i18n/fr';
import { en } from '@/lib/i18n/en';
import imageManifest from './image-manifest.json';

export interface IText {
  fr: string;
  en: string;
}

/**
 * Preset image library (files in public/images) the owner can pick from.
 * Keys are file basenames — the extension is resolved at build time by
 * scripts/gen-image-manifest.mjs, so fresh.jpg works exactly like fresh.png.
 */
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

/** basename -> public URL, regenerated from public/images by scripts/gen-image-manifest.mjs. */
const IMAGE_FILES = imageManifest as Record<string, string>;

export function imageSrc(imageKey: string): string {
  const key = (IMAGE_LIBRARY as readonly string[]).includes(imageKey) ? imageKey : 'fresh';
  return IMAGE_FILES[key] ?? IMAGE_FILES.fresh ?? `/images/${key}.png`;
}

/**
 * Resolve the display image for a product/news item: an uploaded URL (object
 * storage, or a legacy Cloudinary URL) wins over the local library key.
 *
 * The URL is validated rather than trusted. It reaches this function from the
 * database, and rendering it straight into an <img src> would turn any write
 * path that bypasses the admin API — a bad import, a future migration — into
 * stored XSS. isAllowedImageUrl is the same allowlist the CSP img-src uses.
 */
export function resolveImage(item: { imageUrl?: string | null; imageKey?: string }): string {
  return isAllowedImageUrl(item.imageUrl) ? (item.imageUrl as string).trim() : imageSrc(item.imageKey || 'fresh');
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
  /** Cloudinary-hosted image; when set it takes precedence over imageKey. */
  imageUrl?: string | null;
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
  /** Cloudinary-hosted image; when set it takes precedence over imageKey. */
  imageUrl?: string | null;
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
  /** Optional Cloudinary URL for the hero image; '' falls back to the local hero file in public/images. */
  heroImage: string;
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

export interface CmsTeamMember {
  id: string;
  name: string;
  role: IText;
  bio?: IText;
  imageUrl?: string | null;
  imageKey?: string;
  sortOrder: number;
  published: boolean;
}

export interface CmsTeam {
  title: IText;
  subtitle: IText;
  members: CmsTeamMember[];
}

export interface CmsPartner {
  id: string;
  name: string;
  logoUrl?: string | null;
  logoKey?: string;
  description?: IText;
  websiteUrl?: string;
  sortOrder: number;
  published: boolean;
}

export interface CmsPartners {
  title: IText;
  subtitle: IText;
  items: CmsPartner[];
}

export interface CmsSettings {
  contact: CmsContact;
  home: CmsHome;
  training: CmsTraining;
  about: CmsAbout;
  sustainability: CmsSustainability;
  team: CmsTeam;
  partners: CmsPartners;
}

export type SettingKey = keyof CmsSettings;
export const SETTING_KEYS: SettingKey[] = [
  'contact',
  'home',
  'training',
  'about',
  'sustainability',
  'team',
  'partners',
];

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
    heroImage: '',
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
  team: {
    title: it('Notre Équipe', 'Our Team'),
    subtitle: it(
      'Des professionnels engagés pour une agriculture durable et prospère au Burundi.',
      'Passionate professionals committed to sustainable and prosperous agriculture in Burundi.'
    ),
    members: [
      {
        id: 'team-1',
        name: 'Dr. Fabrice Nkurunziza',
        role: it('Directeur Général & Co-fondateur', 'Managing Director & Co-Founder'),
        bio: it(
          'Spécialiste en biotechnologie végétale et valorisation circulaire de la biomasse.',
          'Specialist in plant biotechnology and circular biomass valorisation.'
        ),
        imageKey: 'training',
        imageUrl: null,
        sortOrder: 1,
        published: true,
      },
      {
        id: 'team-2',
        name: 'Mireille Uwimana',
        role: it('Responsable Myciculture & Qualité', 'Mushroom Production & Quality Lead'),
        bio: it(
          'Ingénieure agronome dédiée à la préparation des substrats et au contrôle de fructification.',
          'Agronomist dedicated to substrate formulation and fruiting chamber management.'
        ),
        imageKey: 'fresh',
        imageUrl: null,
        sortOrder: 2,
        published: true,
      },
      {
        id: 'team-3',
        name: 'Jean-Claude Hakizimana',
        role: it('Responsable Engrais Bio & Valorisation', 'Bio-Fertilizer & Composting Lead'),
        bio: it(
          'Expert en recyclage du substrat usé et formulation d’amendements organiques.',
          'Expert in spent substrate upcycling and organic soil conditioner formulation.'
        ),
        imageKey: 'fertilizer',
        imageUrl: null,
        sortOrder: 3,
        published: true,
      },
      {
        id: 'team-4',
        name: 'Chantal Ndayisaba',
        role: it('Coordinatrice Formation & Partenariats', 'Training & Partnerships Coordinator'),
        bio: it(
          'Animatrice de projets communautaires pour l’autonomisation des jeunes et des femmes.',
          'Community trainer passionate about youth and women empowerment through mushroom farming.'
        ),
        imageKey: 'hero',
        imageUrl: null,
        sortOrder: 4,
        published: true,
      },
    ],
  },
  partners: {
    title: it('Nos Partenaires & Collaborateurs', 'Our Partners & Collaborators'),
    subtitle: it(
      'Ensemble pour promouvoir la myciculture et la fertilisation bio au Burundi.',
      'Working together to promote mushroom farming and bio-organic fertilization in Burundi.'
    ),
    items: [
      {
        id: 'partner-1',
        name: 'CAPAD Burundi',
        description: it(
          'Confédération des Associations des Producteurs Agricoles pour le Développement',
          'Confederation of Agricultural Producer Associations for Development'
        ),
        websiteUrl: 'https://capad.bi',
        logoUrl: null,
        logoKey: 'training',
        sortOrder: 1,
        published: true,
      },
      {
        id: 'partner-2',
        name: 'ISABU',
        description: it(
          'Institut des Sciences Agronomiques du Burundi — Recherche & semences',
          'Burundi Agronomic Sciences Institute — Research & Spawn Collaboration'
        ),
        websiteUrl: '',
        logoUrl: null,
        logoKey: 'fresh',
        sortOrder: 2,
        published: true,
      },
      {
        id: 'partner-3',
        name: 'Burundi Agribusiness Network',
        description: it(
          'Réseau d’entrepreneuriat agroalimentaire et développement rural',
          'Agribusiness entrepreneurship and rural development network'
        ),
        websiteUrl: '',
        logoUrl: null,
        logoKey: 'sustainability',
        sortOrder: 3,
        published: true,
      },
      {
        id: 'partner-4',
        name: 'Coopérative Twitezimbere',
        description: it(
          'Groupement local de producteurs et transformateurs de champignons',
          'Local mushroom growers and processors cooperative'
        ),
        websiteUrl: '',
        logoUrl: null,
        logoKey: 'fertilizer',
        sortOrder: 4,
        published: true,
      },
    ],
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
export function mergeSettings(raw: CmsSettings | Record<string, unknown>): CmsSettings {
  const source = raw as Record<string, unknown>;
  const pick = <K extends SettingKey>(key: K): CmsSettings[K] => {
    const r = source[key];
    return r && typeof r === 'object' && !Array.isArray(r)
      ? ({ ...DEFAULT_SETTINGS[key], ...(r as object) } as CmsSettings[K])
      : DEFAULT_SETTINGS[key];
  };

  const pickTeam = (): CmsTeam => {
    const r = source['team'] as Partial<CmsTeam> | undefined;
    if (!r || typeof r !== 'object' || Array.isArray(r)) return DEFAULT_SETTINGS.team;
    return {
      title: r.title ? { ...DEFAULT_SETTINGS.team.title, ...r.title } : DEFAULT_SETTINGS.team.title,
      subtitle: r.subtitle ? { ...DEFAULT_SETTINGS.team.subtitle, ...r.subtitle } : DEFAULT_SETTINGS.team.subtitle,
      members: Array.isArray(r.members) ? r.members : DEFAULT_SETTINGS.team.members,
    };
  };

  const pickPartners = (): CmsPartners => {
    const r = source['partners'] as Partial<CmsPartners> | undefined;
    if (!r || typeof r !== 'object' || Array.isArray(r)) return DEFAULT_SETTINGS.partners;
    return {
      title: r.title ? { ...DEFAULT_SETTINGS.partners.title, ...r.title } : DEFAULT_SETTINGS.partners.title,
      subtitle: r.subtitle ? { ...DEFAULT_SETTINGS.partners.subtitle, ...r.subtitle } : DEFAULT_SETTINGS.partners.subtitle,
      items: Array.isArray(r.items) ? r.items : DEFAULT_SETTINGS.partners.items,
    };
  };

  return {
    contact: pick('contact'),
    home: pick('home'),
    training: pick('training'),
    about: pick('about'),
    sustainability: pick('sustainability'),
    team: pickTeam(),
    partners: pickPartners(),
  };
}
