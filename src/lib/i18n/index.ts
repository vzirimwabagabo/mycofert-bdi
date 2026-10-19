import { fr, type Dict } from './fr';
import { en } from './en';

export type Lang = 'fr' | 'en';

export const LANGS: Lang[] = ['fr', 'en'];
export const DEFAULT_LANG: Lang = 'fr';

export const dictionaries: Record<Lang, Dict> = { fr, en };

export function isLang(v: string | null | undefined): v is Lang {
  return v === 'fr' || v === 'en';
}

export function getDict(lang: Lang): Dict {
  return dictionaries[lang] ?? fr;
}

export type { Dict };
