// Next.js `output: "standalone"` produces .next/standalone/server.js but does
// not include .next/static or public/ — both must be copied in for the
// artifact to be runnable on its own. This replaces the previous Unix-only
// `cp -r` in the build script so `npm run build` works on any platform.
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const standalone = join(root, '.next', 'standalone');
const staticDir = join(root, '.next', 'static');
const publicDir = join(root, 'public');

if (!existsSync(join(standalone, 'server.js'))) {
  console.error('prepare-standalone: .next/standalone/server.js not found — did `next build` run with output:"standalone"?');
  process.exit(1);
}

if (existsSync(staticDir)) {
  mkdirSync(join(standalone, '.next'), { recursive: true });
  cpSync(staticDir, join(standalone, '.next', 'static'), { recursive: true });
}
if (existsSync(publicDir)) {
  cpSync(publicDir, join(standalone, 'public'), { recursive: true });
}

console.log('prepare-standalone: static assets and public/ copied into the standalone artifact');
