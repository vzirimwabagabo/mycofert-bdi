// Which image URLs may be stored and rendered.
//
// This is the single source of truth for that question, and it mirrors the CSP
// img-src allowlist in src/proxy.ts exactly: a URL that fails here would be
// blocked by the browser anyway, so it is rejected at the write boundary
// instead of being stored and silently rendering as a broken image.
//
// Deliberately pure — no node APIs — because it is imported by server route
// handlers AND by client components (resolveImage renders on both sides).

const LEGACY_CLOUDINARY_PREFIX = 'https://res.cloudinary.com';

/**
 * Public base URL of the object-storage bucket, e.g.
 *   Supabase: https://<ref>.supabase.co/storage/v1/object/public/mycofert
 *   Neon:     https://<bucket>.storage.<region>.aws.neon.tech
 *
 * This is not a secret: it is the URL every visitor's browser already fetches
 * the images from. That is why it is a NEXT_PUBLIC_ variable — client
 * components have to validate stored URLs too.
 *
 * CONSEQUENCE: a NEXT_PUBLIC_ value is inlined into the client bundle at BUILD
 * time. Changing it requires a rebuild, not just a restart. On the server it is
 * read at runtime as usual.
 */
const STORAGE_PUBLIC_URL = (process.env.NEXT_PUBLIC_STORAGE_PUBLIC_URL ?? '')
  .trim()
  .replace(/\/+$/, '');

/** Longest URL we will store. Anything longer is not a real delivery URL. */
const MAX_URL_LENGTH = 1000;

/**
 * Origins a stored image URL may use at render time.
 *
 * Cloudinary is kept so that rows written before the move to object storage
 * keep working — rejecting them would leave the dashboard unable to re-save an
 * existing product. It can be dropped once every stored imageUrl has been
 * migrated (or cleared).
 */
export const ALLOWED_IMAGE_ORIGINS: readonly string[] = [
  ...(STORAGE_PUBLIC_URL ? [STORAGE_PUBLIC_URL] : []),
  LEGACY_CLOUDINARY_PREFIX,
];

/** Whether object storage is configured for this build. */
export function objectStoragePublicUrlConfigured(): boolean {
  return STORAGE_PUBLIC_URL !== '';
}

/**
 * Accept only URLs on the origins above, and only over https.
 *
 * The origin is matched WITH its trailing slash so that
 * `https://res.cloudinary.com.evil.example/x.png` cannot pass as a prefix
 * match of `https://res.cloudinary.com`.
 */
export function isAllowedImageUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const url = value.trim();
  if (!url || url.length > MAX_URL_LENGTH) return false;
  if (!url.startsWith('https://')) return false;
  return ALLOWED_IMAGE_ORIGINS.some((origin) => url.startsWith(`${origin}/`));
}
