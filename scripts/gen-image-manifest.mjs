// Regenerates src/lib/image-manifest.json from the files actually present in
// public/images, so the preset image library (fresh / dried / hero / ...)
// resolves no matter which extension the file on disk uses
// (.png .jpg .jpeg .webp .avif .gif .svg).
//
// Runs automatically before `npm run dev` and `npm run build` (see package.json).
// Re-run it manually after adding or replacing a file in public/images.
import { readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const imagesDir = join(here, '..', 'public', 'images');
const outFile = join(here, '..', 'src', 'lib', 'image-manifest.json');

// Accepted extensions, best-compression first: if the same slot exists in
// several formats the earliest one here wins (and a warning is printed).
const EXT_PRIORITY = ['avif', 'webp', 'jpg', 'jpeg', 'png', 'gif', 'svg'];
const NAME_RE = /^(.+)\.([a-z0-9]+)$/i;

let files = [];
try {
  files = readdirSync(imagesDir);
} catch {
  console.warn(`[images] ${imagesDir} not found — writing an empty manifest.`);
}

/** slot basename -> { file, ext } */
const bySlot = new Map();
for (const file of files) {
  const match = NAME_RE.exec(file);
  if (!match) continue;
  const slot = match[1];
  const ext = match[2].toLowerCase();
  if (!EXT_PRIORITY.includes(ext)) continue;

  const prev = bySlot.get(slot);
  if (!prev) {
    bySlot.set(slot, { file, ext });
    continue;
  }
  const keepNew = EXT_PRIORITY.indexOf(ext) < EXT_PRIORITY.indexOf(prev.ext);
  console.warn(
    `[images] "${slot}" is present as both .${prev.ext} and .${ext} — using .${
      keepNew ? ext : prev.ext
    }. Delete the duplicate.`
  );
  if (keepNew) bySlot.set(slot, { file, ext });
}

const manifest = {};
for (const slot of [...bySlot.keys()].sort()) {
  manifest[slot] = `/images/${bySlot.get(slot).file}`;
}

writeFileSync(outFile, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`[images] Wrote ${Object.keys(manifest).length} image entries to src/lib/image-manifest.json`);
