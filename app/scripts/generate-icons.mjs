// Generates app icons from the Wingman winged-heart mark using sharp.
// Run: npm run icons
import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'icons');
mkdirSync(OUT, { recursive: true });

const GRAD = `<linearGradient id="wm" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#3b82f6"/><stop offset="1" stop-color="#22d3ee"/></linearGradient>`;

// The winged-heart mark, drawn in a 512 viewBox.
const MARK = `<g fill="url(#wm)">
  <path d="M214 250 C150 204 78 200 36 158 C60 212 104 248 172 260 C138 258 116 270 94 268 C128 282 176 280 206 270 Z"/>
  <path d="M298 250 C362 204 434 200 476 158 C452 212 408 248 340 260 C374 258 396 270 418 268 C384 282 336 280 306 270 Z"/>
  <path d="M256 384 C247 384 238 380 231 373 L186 328 C165 307 165 273 186 252 C205 233 237 231 258 250 C279 231 311 233 330 252 C351 273 351 307 330 328 L285 373 C278 380 269 384 256 384 Z"/>
</g>`;

// Rounded tile (home-screen icon). scale shrinks the mark for maskable safe zone.
const tile = (rounded, scale = 1) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>${GRAD}</defs>
  <rect width="512" height="512" ${rounded ? 'rx="112"' : ''} fill="#0b1220"/>
  <g transform="translate(256 262) scale(${scale}) translate(-256 -262)">${MARK}</g>
</svg>`;

const jobs = [
  ['icon-192.png', 192, tile(true)],
  ['icon-512.png', 512, tile(true)],
  ['icon-maskable-512.png', 512, tile(false, 0.72)], // full-bleed, mark inside safe zone
  ['apple-touch-icon.png', 180, tile(false)],
];

for (const [name, size, svg] of jobs) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(join(OUT, name));
  console.log('wrote', name, size + 'x' + size);
}

// A preview for quick visual review (not shipped).
await sharp(Buffer.from(tile(true))).resize(256, 256).png().toFile(join(ROOT, 'logo-preview.png'));
console.log('wrote logo-preview.png');
