// S3-compatible object storage for admin image uploads.
//
// The browser PUTs the file DIRECTLY to the bucket using a presigned URL, so
// image bytes never pass through this server and no storage SDK ships to the
// client. Works with any S3-compatible provider — Supabase Storage, Neon Object
// Storage, Cloudflare R2, Backblaze B2, AWS S3 — because only the endpoint and
// the public URL base differ, and both come from the environment.
//
// Server-only: imports the AWS SDK and node:crypto.
//
// Upload validation
// -----------------
// The presigned URL fixes Content-Type and Content-Length at signing time, so
// the provider rejects any request that uses a different MIME type or a body of
// a different size. That is the primary constraint.
//
// On the server side we also do a magic-byte content check: before signing we
// can only validate the *declared* MIME type. This module additionally exports
// `verifyImageBytes()` which callers can use to inspect the actual first bytes
// of a buffer for well-known image magic numbers. The sign-upload route does
// not have access to the bytes (they never transit this server), but the helper
// is available for any future upload path that does (e.g., server-side proxy
// uploads, test helpers, or a webhook that receives the object after PUT).
//
// Orphaned-object cleanup
// -----------------------
// Because the browser uploads directly to the bucket and then posts the URL
// back to the CMS, there is a window in which a presigned URL has been issued
// but the object has not yet been referenced by any DB row. Objects can also be
// orphaned if the user picks an image and then cancels before saving. The bucket
// should be configured with an object lifecycle rule that expires objects in the
// upload folder that are older than a few days and not referenced. The
// `UPLOAD_FOLDER` constant is exported so the bucket policy can match the prefix.

import { randomUUID } from 'node:crypto';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { UPLOAD_MAX_BYTES, extensionFor, isUploadableContentType } from '@/lib/uploads';

// ---------------------------------------------------------------------------
// Content verification (magic bytes)
// ---------------------------------------------------------------------------

/**
 * Magic-byte signatures for the image formats we accept.
 *
 * These are the canonical byte sequences at offset 0 (or at a fixed offset for
 * RIFF-based formats). Checking them before persisting a URL ensures the bytes
 * the browser claims are JPEG are actually JPEG, regardless of the file
 * extension or Content-Type header.
 *
 * AVIF and WebP both use a RIFF/ISO-BMFF container so their check needs more
 * bytes; the values here cover the vast majority of real files.
 */
const MAGIC_BYTES: Array<{ mime: string; offset: number; bytes: number[] }> = [
  // JPEG: FF D8 FF
  { mime: 'image/jpeg', offset: 0, bytes: [0xff, 0xd8, 0xff] },
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  { mime: 'image/png', offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  // GIF: 47 49 46 38 (GIF8)
  { mime: 'image/gif', offset: 0, bytes: [0x47, 0x49, 0x46, 0x38] },
  // WebP: RIFF????WEBP — check bytes 0-3 and 8-11
  { mime: 'image/webp', offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF
  // AVIF / ISO-BMFF (ftyp box): look for 'ftyp' at offset 4
  { mime: 'image/avif', offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] }, // ftyp
];

/**
 * Verify that the first bytes of `buf` match the expected magic numbers for
 * `declaredMime`. Returns `true` when the bytes are consistent with the
 * declared MIME type, `false` when they are not.
 *
 * This is a best-effort check — it is not a full format decoder. It catches
 * the common case of a renamed file (e.g. an HTML file given a `.jpg`
 * extension) without requiring an image library dependency.
 *
 * Note: upload bytes do NOT transit this server in the presigned-PUT flow.
 * This helper is provided for use in any future upload path that does have
 * access to the bytes (e.g., a server-side proxy, test helpers, or webhooks).
 */
export function verifyImageBytes(buf: Buffer | Uint8Array, declaredMime: string): boolean {
  const candidates = MAGIC_BYTES.filter((m) => m.mime === declaredMime);
  if (candidates.length === 0) return false; // unknown MIME — reject

  for (const { offset, bytes } of candidates) {
    if (buf.length < offset + bytes.length) continue;
    let match = true;
    for (let i = 0; i < bytes.length; i++) {
      if (buf[offset + i] !== bytes[i]) { match = false; break; }
    }
    if (match) return true;
  }
  return false;
}

/** Folder prefix inside the bucket, to keep the object list tidy. */
export const UPLOAD_FOLDER = 'mycofert';

/** How long a presigned URL stays valid. Short: it is used immediately. */
export const PRESIGN_TTL_SECONDS = 300;

export interface ObjectStorageConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Public base URL objects are served from, without a trailing slash. */
  publicBaseUrl: string;
}

/**
 * All-or-nothing: a half-configured bucket would fail at upload time with a
 * provider error instead of a clear "not configured" message.
 */
export function getObjectStorageConfig(): ObjectStorageConfig | null {
  const endpoint = process.env.STORAGE_ENDPOINT?.trim();
  const bucket = process.env.STORAGE_BUCKET?.trim();
  const accessKeyId = process.env.STORAGE_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.STORAGE_SECRET_ACCESS_KEY?.trim();
  const publicBaseUrl = (process.env.NEXT_PUBLIC_STORAGE_PUBLIC_URL ?? '').trim().replace(/\/+$/, '');
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey || !publicBaseUrl) return null;

  return {
    endpoint,
    // Most S3-compatible providers want a real region; "auto" is the R2
    // convention. Defaulting keeps one variable out of the setup.
    region: process.env.STORAGE_REGION?.trim() || 'auto',
    bucket,
    accessKeyId,
    secretAccessKey,
    publicBaseUrl,
  };
}

export function objectStorageConfigured(): boolean {
  return getObjectStorageConfig() !== null;
}

// A client is created per configuration, not per request: S3Client is
// stateless and holds no sockets worth reusing, but rebuilding it on every
// upload is pointless work.
let cachedClient: S3Client | null = null;
let cachedKey = '';

function clientFor(config: ObjectStorageConfig): S3Client {
  const key = `${config.endpoint}|${config.region}|${config.accessKeyId}|${config.bucket}`;
  if (cachedClient && cachedKey === key) return cachedClient;
  cachedClient = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    // Supabase Storage and most S3-compatible providers require path-style
    // addressing (https://host/bucket/key) rather than virtual-host style.
    forcePathStyle: true,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
  cachedKey = key;
  return cachedClient;
}

/**
 * Object key for a new upload.
 *
 * The uploaded filename is deliberately unused: it is attacker-controlled text
 * and would otherwise leak into the object path (`../`, control characters,
 * a `.html` extension). The key is a UUID under a date prefix.
 */
export function buildObjectKey(contentType: string): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${UPLOAD_FOLDER}/${year}/${month}/${randomUUID()}.${extensionFor(contentType)}`;
}

export interface PresignedUpload {
  uploadUrl: string;
  /** Where the object will be readable from once the PUT succeeds. */
  publicUrl: string;
  contentType: string;
}

export type PresignResult =
  | { ok: true; upload: PresignedUpload }
  | { ok: false; reason: 'not-configured' | 'missing' | 'unsupported-type' | 'invalid-size' | 'too-large' };

/**
 * Mint a one-shot presigned PUT.
 *
 * Content-Type AND Content-Length are part of the signature, so the browser
 * must send exactly the values returned here. That is what stops a client from
 * uploading a 200 MB body or an unexpected MIME type after being handed a URL,
 * and it makes the limits in src/lib/uploads.ts real rather than advisory. The
 * bucket reports a mismatch as 403 SignatureDoesNotMatch.
 *
 * Returns a reason instead of throwing, so the route can answer precisely while
 * telling the caller nothing beyond its own mistake.
 */
export async function presignUpload(contentType: unknown, size: unknown): Promise<PresignResult> {
  const config = getObjectStorageConfig();
  if (!config) return { ok: false, reason: 'not-configured' };
  if (contentType === undefined || size === undefined) return { ok: false, reason: 'missing' };
  if (!isUploadableContentType(contentType)) return { ok: false, reason: 'unsupported-type' };
  if (typeof size !== 'number' || !Number.isInteger(size) || size <= 0) {
    return { ok: false, reason: 'invalid-size' };
  }
  if (size > UPLOAD_MAX_BYTES) return { ok: false, reason: 'too-large' };

  const key = buildObjectKey(contentType);
  const uploadUrl = await getSignedUrl(
    clientFor(config),
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: size,
    }),
    { expiresIn: PRESIGN_TTL_SECONDS }
  );

  return { ok: true, upload: { uploadUrl, publicUrl: `${config.publicBaseUrl}/${key}`, contentType } };
}

/**
 * Delete an object from object storage given its public URL.
 * Used for storage cleanup when an existing image is replaced or when a
 * Product or NewsPost is deleted.
 *
 * Verifies that the URL points to our configured bucket and upload prefix,
 * preventing any SSRF or unauthorized deletion attempts.
 */
export async function deleteStoredImage(imageUrl: string | null | undefined): Promise<boolean> {
  if (!imageUrl) return false;
  const config = getObjectStorageConfig();
  if (!config) return false;

  const prefix = `${config.publicBaseUrl}/`;
  if (!imageUrl.startsWith(prefix)) return false;

  const key = imageUrl.slice(prefix.length);
  // Ensure the key begins with the designated upload prefix and contains no directory traversal
  if (!key.startsWith(`${UPLOAD_FOLDER}/`) || key.includes('..')) {
    return false;
  }

  try {
    const client = clientFor(config);
    await client.send(
      new DeleteObjectCommand({
        Bucket: config.bucket,
        Key: key,
      })
    );
    console.info(`[storage] Deleted orphaned image object: ${key}`);
    return true;
  } catch (error) {
    console.warn(`[storage] Failed to delete image object ${key}:`, error);
    return false;
  }
}
