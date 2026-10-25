'use client';

// Shared building blocks for the admin dashboard panels:
// bilingual fields (FR/EN), image picker + upload, auth headers and common
// types.

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { UPLOAD_ACCEPT, UPLOAD_MAX_BYTES, isUploadableContentType } from '@/lib/uploads';
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

// ---------------------------------------------------------------------------
// Images: preset library + upload to the configured storage provider
// ---------------------------------------------------------------------------

/** What /api/admin/sign-upload hands back, keyed by the provider it chose. */
type UploadIntent =
  | { provider: 'storage'; uploadUrl: string; publicUrl: string; contentType: string }
  | {
      provider: 'cloudinary';
      signature: string;
      timestamp: number;
      apiKey: string;
      cloudName: string;
      folder: string;
    };

/**
 * Upload an image straight to the configured provider with a server-issued
 * credential. The bytes never pass through our own API.
 */
async function uploadImage(token: string, file: File): Promise<string> {
  const signRes = await fetch('/api/admin/sign-upload', {
    method: 'POST',
    headers: { 'x-admin-token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ contentType: file.type, size: file.size }),
  });
  if (!signRes.ok) {
    const body = (await signRes.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? 'Upload is not available on this server.');
  }
  const intent = (await signRes.json()) as UploadIntent;

  if (intent.provider === 'storage') {
    // Content-Type and Content-Length are part of the presigned signature, so
    // the request must carry exactly what the server signed. The file is the
    // body, and the browser derives Content-Length from it.
    let putRes: Response;
    try {
      putRes = await fetch(intent.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': intent.contentType },
        body: file,
      });
    } catch {
      // fetch() rejects only on a transport failure. For a cross-origin PUT
      // that almost always means the bucket has no CORS rule for this origin.
      throw new Error(
        'Could not reach the storage bucket. Check that its CORS rules allow PUT from this site.'
      );
    }
    if (!putRes.ok) {
      throw new Error(
        putRes.status === 403
          ? 'Storage rejected the upload (signature mismatch).'
          : `Storage rejected the upload (HTTP ${putRes.status}).`
      );
    }
    return intent.publicUrl;
  }

  const form = new FormData();
  form.append('file', file);
  form.append('api_key', intent.apiKey);
  form.append('timestamp', String(intent.timestamp));
  form.append('folder', intent.folder);
  form.append('signature', intent.signature);

  const upRes = await fetch(`https://api.cloudinary.com/v1_1/${intent.cloudName}/image/upload`, {
    method: 'POST',
    body: form,
  });
  if (!upRes.ok) {
    // Cloudinary explains the failure (bad credentials, unsupported format,
    // over quota, ...) in the body — surface it instead of a bare status.
    const detail = (await upRes.json().catch(() => null)) as { error?: { message?: string } } | null;
    const reason = detail?.error?.message;
    throw new Error(
      reason ? `Cloudinary rejected the upload: ${reason}` : `Cloudinary rejected the upload (HTTP ${upRes.status}).`
    );
  }
  const json = (await upRes.json()) as { secure_url?: string };
  if (!json.secure_url) throw new Error('Cloudinary did not return an image URL.');
  return json.secure_url;
}

export interface ImageValue {
  imageKey: string;
  imageUrl: string | null;
}

/**
 * Image field: an upload to the configured storage provider (when configured)
 * plus the preset library (files in public/images — any of
 * .png/.jpg/.jpeg/.webp/.avif/.gif/.svg).
 * Selecting a library image clears any uploaded URL — the two are mutually
 * exclusive, uploaded image wins when set.
 */
export function ImagePicker({
  label,
  token,
  value,
  onChange,
  uploadLabel = 'Upload image',
  clearLabel = 'Use library image instead',
}: {
  label: string;
  token: string;
  value: ImageValue;
  onChange: (next: ImageValue) => void;
  uploadLabel?: string;
  clearLabel?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    // Checked against the same allowlist the server signs for, so the UI never
    // offers a file the upload route would reject.
    if (!isUploadableContentType(file.type)) {
      setError('Use a JPEG, PNG, WebP, AVIF or GIF image.');
      return;
    }
    if (file.size > UPLOAD_MAX_BYTES) {
      setError(`Image must be under ${UPLOAD_MAX_BYTES / (1024 * 1024)} MB.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const url = await uploadImage(token, file);
      onChange({ ...value, imageUrl: url });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label>{label}</Label>
        <label
          className={cn(
            'cursor-pointer rounded-md border border-input px-2.5 py-1 text-xs font-medium transition-colors',
            busy ? 'opacity-60' : 'hover:bg-secondary/70'
          )}
        >
          <input
            type="file"
            accept={UPLOAD_ACCEPT}
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              void onFile(e.target.files?.[0]);
              e.currentTarget.value = '';
            }}
          />
          {busy ? 'Uploading…' : `⬆ ${uploadLabel}`}
        </label>
      </div>

      {value.imageUrl ? (
        <div className="flex items-center gap-3">
          <div className="h-14 w-20 overflow-hidden rounded-lg border-2 border-[#2F6B3F]">
            <img src={value.imageUrl} alt="" aria-hidden="true" className="h-full w-full object-cover" />
          </div>
          <button
            type="button"
            onClick={() => onChange({ ...value, imageUrl: null })}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            ✕ {clearLabel}
          </button>
        </div>
      ) : null}

      <div className="flex gap-2 overflow-x-auto pb-2" role="radiogroup" aria-label={label}>
        {IMAGE_LIBRARY.map((key) => {
          const selected = !value.imageUrl && value.imageKey === key;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange({ imageKey: key, imageUrl: null })}
              className={cn(
                'relative h-14 w-20 shrink-0 overflow-hidden rounded-lg border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                selected ? 'border-[#2F6B3F] shadow-md' : 'border-transparent opacity-70 hover:opacity-100'
              )}
              title={key}
            >
              <img src={imageSrc(key)} alt={key} className="h-full w-full object-cover" loading="lazy" />
            </button>
          );
        })}
      </div>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
