'use client';

// Shared building blocks for the admin dashboard panels:
// bilingual fields (FR/EN), image picker, auth headers and common types.

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { IMAGE_LIBRARY, imageSrc, type CmsNews, type CmsProduct, type CmsSettings, type IText } from '@/lib/cms-defaults';

export interface AdminContent {
  settings: CmsSettings;
  products: CmsProduct[];
  news: CmsNews[];
}

export function authHeaders(token: string): Record<string, string> {
  return { 'x-admin-token': token, 'Content-Type': 'application/json' };
}

/** Small language chip shown in front of every bilingual field. */
export function LangChip({ lang }: { lang: 'fr' | 'en' }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 w-7 shrink-0 items-center justify-center rounded text-[10px] font-bold tracking-wide',
        lang === 'fr' ? 'bg-[#2F6B3F] text-white' : 'bg-[#8B5A2B] text-white'
      )}
      aria-label={lang === 'fr' ? 'Français' : 'English'}
    >
      {lang.toUpperCase()}
    </span>
  );
}

interface BiFieldProps {
  label: string;
  value: IText;
  onChange: (next: IText) => void;
  hint?: string;
  maxLength?: number;
  rows?: number;
}

/** Single-line bilingual input: label + FR input and EN input side by side. */
export function BiInput({ label, value, onChange, hint, maxLength = 300 }: BiFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="flex items-center gap-2">
          <LangChip lang="fr" />
          <Input
            value={value.fr}
            onChange={(e) => onChange({ ...value, fr: e.target.value })}
            maxLength={maxLength}
            aria-label={`${label} (FR)`}
          />
        </div>
        <div className="flex items-center gap-2">
          <LangChip lang="en" />
          <Input
            value={value.en}
            onChange={(e) => onChange({ ...value, en: e.target.value })}
            maxLength={maxLength}
            aria-label={`${label} (EN)`}
          />
        </div>
      </div>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** Multi-line bilingual textarea (description, article body, ...). */
export function BiTextarea({ label, value, onChange, hint, maxLength = 5000, rows = 4 }: BiFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <LangChip lang="fr" />
            <span className="sr-only">Français</span>
          </div>
          <Textarea
            value={value.fr}
            onChange={(e) => onChange({ ...value, fr: e.target.value })}
            rows={rows}
            maxLength={maxLength}
            aria-label={`${label} (FR)`}
          />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <LangChip lang="en" />
            <span className="sr-only">English</span>
          </div>
          <Textarea
            value={value.en}
            onChange={(e) => onChange({ ...value, en: e.target.value })}
            rows={rows}
            maxLength={maxLength}
            aria-label={`${label} (EN)`}
          />
        </div>
      </div>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** Visual picker over the preset image library (public/images/*.png). */
export function ImagePicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2 overflow-x-auto pb-2" role="radiogroup" aria-label={label}>
        {IMAGE_LIBRARY.map((key) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={value === key}
            onClick={() => onChange(key)}
            className={cn(
              'relative h-14 w-20 shrink-0 overflow-hidden rounded-lg border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              value === key ? 'border-[#2F6B3F] shadow-md' : 'border-transparent opacity-70 hover:opacity-100'
            )}
            title={key}
          >
            <img src={imageSrc(key)} alt={key} className="h-full w-full object-cover" loading="lazy" />
          </button>
        ))}
      </div>
    </div>
  );
}
