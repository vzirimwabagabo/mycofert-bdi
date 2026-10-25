// S3-compatible object storage for admin image uploads.
//
// The browser PUTs the file DIRECTLY to the bucket using a presigned URL, so
// image bytes never pass through this server and no storage SDK ships to the
// client. Works with any S3-compatible provider — Supabase Storage, Neon Object
// Storage, Cloudflare R2, Backblaze B2, AWS S3 — because only the endpoint and
// the public URL base differ, and both come from the environment.
//
// Server-only: imports the AWS SDK and node:crypto.

import { randomUUID } from 'node:crypto';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { UPLOAD_MAX_BYTES, extensionFor, isUploadableContentType } from '@/lib/uploads';

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
