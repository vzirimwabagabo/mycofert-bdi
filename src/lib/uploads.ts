// The upload contract, shared by the browser and the server.
//
// Both sides must agree on which image types are acceptable and how large a
// file may be, otherwise the UI happily offers a file the server then rejects.
// Pure module: no node APIs, no SDK imports, safe in a client bundle.

/**
 * Uploadable image types, mapped to the extension used in the object key.
 *
 * SVG is deliberately absent. An SVG is a document that can carry script and
 * external references, and these files are served from a public bucket at a
 * stable URL — the local image library keeps SVG support, untrusted uploads do
 * not get it.
 */
export const UPLOAD_TYPES: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
};

/** Largest file the dashboard will upload, and the largest the server will sign for. */
export const UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

/** `accept` attribute for the file input — derived so it cannot drift. */
export const UPLOAD_ACCEPT = Object.keys(UPLOAD_TYPES).join(',');

export function isUploadableContentType(value: unknown): value is keyof typeof UPLOAD_TYPES {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(UPLOAD_TYPES, value);
}

export function extensionFor(contentType: string): string {
  return UPLOAD_TYPES[contentType] ?? 'jpg';
}
