// Mint a one-shot upload credential for the admin dashboard.
//
// The browser then sends the file DIRECTLY to the provider with it; image bytes
// never transit this server. Requires a valid admin token, so the upload
// endpoint cannot be used anonymously.
//
// Two providers, one route — object storage wins when it is configured:
//   STORAGE_* set      -> presigned S3 PUT   (Supabase Storage, Neon, R2, B2, S3)
//   STORAGE_* unset    -> Cloudinary signed-upload params (fallback)
// The response says which one it is, so the client never has to guess.

import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_TOKEN_HEADER, verifyRequest } from '@/lib/auth';
import { LIMIT_ADMIN_API, rateLimitRequest, rateLimitHeaders } from '@/lib/rate-limit';
import { cloudinaryConfigured, createUploadSignature } from '@/lib/cloudinary';
import { objectStorageConfigured, presignUpload } from '@/lib/object-storage';
import { UPLOAD_MAX_BYTES } from '@/lib/uploads';

export const dynamic = 'force-dynamic';

const MAX_MB = UPLOAD_MAX_BYTES / (1024 * 1024);

export async function POST(req: NextRequest) {
  const limit = await rateLimitRequest(req, LIMIT_ADMIN_API);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: rateLimitHeaders(limit) }
    );
  }

  const auth = verifyRequest(req.headers.get(ADMIN_TOKEN_HEADER));
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.reason === 'expired' ? 'Session expired' : 'Unauthorized' },
      { status: 401, headers: auth.reason === 'expired' ? { 'X-Session-Expired': '1' } : undefined }
    );
  }

  const body = (await req.json().catch(() => null)) as
    | { contentType?: unknown; size?: unknown }
    | null;

  if (objectStorageConfigured()) {
    const result = await presignUpload(body?.contentType, body?.size);
    if (!result.ok) {
      if (result.reason === 'missing') {
        return NextResponse.json(
          { error: 'contentType and size are required' },
          { status: 400 }
        );
      }
      if (result.reason === 'unsupported-type') {
        return NextResponse.json(
          { error: 'Unsupported image type. Use JPEG, PNG, WebP, AVIF or GIF.' },
          { status: 400 }
        );
      }
      if (result.reason === 'invalid-size') {
        return NextResponse.json({ error: 'Invalid file size' }, { status: 400 });
      }
      if (result.reason === 'too-large') {
        return NextResponse.json(
          { error: `Image must be under ${MAX_MB} MB` },
          { status: 413 }
        );
      }
      // 'not-configured' cannot happen behind the check above, but a silent
      // fallthrough would sign nothing and return a 500-shaped payload.
      return NextResponse.json({ error: 'Image storage is not configured' }, { status: 503 });
    }

    return NextResponse.json(
      { provider: 'storage', ...result.upload },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }

  if (!cloudinaryConfigured()) {
    return NextResponse.json(
      {
        error:
          'Image uploads are not configured on this server (missing object storage or Cloudinary credentials).',
      },
      { status: 503 }
    );
  }

  const signature = createUploadSignature();
  if (!signature) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  return NextResponse.json(
    { provider: 'cloudinary', ...signature },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
