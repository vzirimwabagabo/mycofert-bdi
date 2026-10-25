// Next.js proxy — runs on every request before the route handler.
//
// Primary job: generate a fresh cryptographic nonce per request and inject it
// into the Content-Security-Policy header, replacing the broad 'unsafe-inline'
// for scripts. The nonce is also exposed via a request header so the layout
// can embed it into Next.js script tags.
//
// This is the standard Next.js nonce pattern:
// https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy

import { NextRequest, NextResponse } from 'next/server';

/** Maximum allowed body size for incoming API requests (2 MB). Direct uploads bypass this proxy. */
const MAX_REQUEST_BODY_BYTES = 2 * 1024 * 1024;

/**
 * Reduce a configured URL to its `scheme://host` origin, for a CSP source list.
 * A CSP entry is an origin, never a path, so the bucket's `/storage/v1/...`
 * prefix must be stripped or the directive matches nothing. Returns '' for a
 * missing or unparseable value, which is simply dropped from the list.
 */
function originOf(value: string | undefined): string {
  if (!value) return '';
  try {
    return new URL(value).origin;
  } catch {
    return '';
  }
}

export function proxy(request: NextRequest) {
  // Reject oversized payloads early at the proxy boundary before parsing JSON.
  const contentLength = request.headers.get('content-length');
  if (contentLength) {
    const bytes = Number.parseInt(contentLength, 10);
    if (Number.isFinite(bytes) && bytes > MAX_REQUEST_BODY_BYTES) {
      return NextResponse.json(
        { error: 'Payload too large. Maximum request size is 2 MB.' },
        { status: 413 }
      );
    }
  }

  // 16 random bytes → 22-char base64url nonce
  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64');

  const isDev = process.env.NODE_ENV !== 'production';

  // Object storage. The browser PUTs to the S3 endpoint, so connect-src needs
  // that origin; the uploaded object is later served (and rendered) from the
  // public base URL, so img-src needs that origin. Both are unset until a
  // bucket is configured, in which case they contribute nothing.
  const storageEndpoint = originOf(process.env.STORAGE_ENDPOINT);
  const storagePublic = originOf(process.env.NEXT_PUBLIC_STORAGE_PUBLIC_URL);

  // Build a nonce-based CSP. 'unsafe-inline' for scripts is replaced by the
  // per-request nonce, which is unguessable by attackers.
  // www.gstatic.com is included in style-src so Chrome's built-in
  // Google Translate feature can inject its stylesheet without CSP errors.
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://www.gstatic.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    // Images: local library, plus the object-storage public host and legacy
    // Cloudinary — the same allowlist src/lib/image-url.ts enforces on write.
    `img-src 'self' data: blob: https://res.cloudinary.com https://www.gstatic.com${storagePublic ? ` ${storagePublic}` : ''}`,
    // connect-src carries the direct browser uploads: a presigned PUT to the
    // S3 endpoint, or the legacy signed upload to the Cloudinary API.
    `connect-src 'self' https://api.cloudinary.com${storageEndpoint ? ` ${storageEndpoint}` : ''}${isDev ? ' ws: http://localhost:*' : ''}`,
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join('; ');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    /*
     * Apply to all routes except:
     * - _next/static  (static files)
     * - _next/image   (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt
     */
    {
      source: '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
