// Cloudinary image hosting.
//
// Uploads are signed server-side and then sent by the browser DIRECTLY to
// Cloudinary — image bytes never pass through this app, and no npm SDK is
// needed (the signature is a plain SHA-1 over the sorted upload params plus
// the API secret, per Cloudinary's signed-upload spec).
//
// Kept as the fallback upload target while object storage is being set up: when
// STORAGE_* is configured, /api/admin/sign-upload presigns an S3 PUT instead.
// Once every deployment has object storage configured, this file and the
// 'cloudinary' branch in that route can be deleted — the URL allowlist that
// used to live here (isAllowedImageUrl) has already moved to src/lib/image-url.ts
// because it is needed on the client too.
//
// Free plan: cloudinary.com pricing gives a generous free tier which is far
// beyond this site's needs.

import { createHash } from 'node:crypto';

export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

export function getCloudinaryConfig(): CloudinaryConfig | null {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
  if (!cloudName || !apiKey || !apiSecret) return null;
  return { cloudName, apiKey, apiSecret };
}

export function cloudinaryConfigured(): boolean {
  return getCloudinaryConfig() !== null;
}

/** Folder all admin uploads land in, to keep the Cloudinary library tidy. */
export const UPLOAD_FOLDER = 'mycofert';

export interface UploadSignature {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
}

/** Cloudinary signature: sha1 of "<k>=<v>&<k>=<v>...<api_secret>" with params sorted by name. */
export function signUpload(timestamp: number, folder: string, apiSecret: string): string {
  const params = `folder=${folder}&timestamp=${timestamp}`;
  return createHash('sha1').update(`${params}${apiSecret}`).digest('hex');
}

/** Mint a one-shot upload signature for the admin dashboard. */
export function createUploadSignature(): UploadSignature | null {
  const config = getCloudinaryConfig();
  if (!config) return null;
  const timestamp = Math.floor(Date.now() / 1000);
  return {
    signature: signUpload(timestamp, UPLOAD_FOLDER, config.apiSecret),
    timestamp,
    apiKey: config.apiKey,
    cloudName: config.cloudName,
    folder: UPLOAD_FOLDER,
  };
}
