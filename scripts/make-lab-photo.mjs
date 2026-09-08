/**
 * Builds the Phase 1 test photo.
 *
 * This is NOT case art — it is a stand-in shaped like the real thing, so hit
 * detection can be proven before a single real photo exists. What matters is
 * that it is a grainy, blown-out, JPEG-compressed night photo, because grain
 * and compression are the things the pixel diff has to survive.
 *
 * The two hotspots below match the example rects in CASES.md exactly:
 *   rod-holders [0.61, 0.34, 0.14, 0.19]
 *   waterline   [0.22, 0.66, 0.31, 0.09]
 *
 * Run: node scripts/make-lab-photo.mjs
 */
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";

const W = 1024;
const H = 768;

// Six rod holders across the transom, sitting inside the rod-holders rect.
const rods = Array.from({ length: 6 }, (_, i) => {
  const x = 632 + i * 27;
  return `<rect x="${x}" y="268" width="9" height="74" rx="3" fill="#8d8579" opacity="0.9"/>
          <rect x="${x}" y="268" width="9" height="8" rx="3" fill="#0a0908"/>`;
}).join("\n");

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#07090d"/>
      <stop offset="100%" stop-color="#12161c"/>
    </linearGradient>
    <linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0d1319"/>
      <stop offset="100%" stop-color="#05080b"/>
    </linearGradient>
    <radialGradient id="flash" cx="45%" cy="52%" r="55%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.42"/>
      <stop offset="55%" stop-color="#ffe9c4" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
    <filter id="soft"><feGaussianBlur stdDeviation="9"/></filter>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  <rect y="470" width="${W}" height="${H - 470}" fill="url(#water)"/>

  <!-- out of focus dock lights on the far shore -->
  <g filter="url(#soft)" opacity="0.75">
    <circle cx="120" cy="300" r="12" fill="#ffb457"/>
    <circle cx="905" cy="286" r="10" fill="#ffd79a"/>
    <circle cx="742" cy="310" r="7" fill="#8fe6d0"/>
  </g>

  <!-- dock planking along the bottom left -->
  <rect x="0" y="600" width="300" height="${H - 600}" fill="#231d16"/>
  <g stroke="#100d0a" stroke-width="3">
    <line x1="0" y1="632" x2="300" y2="640"/>
    <line x1="0" y1="676" x2="300" y2="688"/>
    <line x1="0" y1="722" x2="300" y2="736"/>
  </g>

  <!-- hull: sitting low, waterline high on the side -->
  <path d="M 170 404 L 830 392 L 812 546 Q 500 586 214 552 Z" fill="#c9c2b4"/>
  <path d="M 170 404 L 830 392 L 826 430 L 172 442 Z" fill="#e8e2d6" opacity="0.85"/>

  <!-- superstructure -->
  <rect x="252" y="214" width="268" height="192" rx="8" fill="#b9b2a4"/>
  <rect x="276" y="238" width="96" height="70" rx="5" fill="#161a1d"/>
  <rect x="392" y="238" width="96" height="70" rx="5" fill="#161a1d"/>
  <rect x="300" y="120" width="10" height="96" fill="#6e675c"/>

  <!-- transom / stern deck -->
  <rect x="600" y="330" width="232" height="16" rx="4" fill="#ded7c9"/>
  ${rods}

  <!-- the waterline itself: the hull is down in the water -->
  <path d="M 214 552 Q 500 586 812 546" stroke="#f2ece0" stroke-width="5" fill="none" opacity="0.55"/>
  <path d="M 208 566 Q 500 600 818 558" stroke="#1b232a" stroke-width="12" fill="none" opacity="0.7"/>
  <path d="M 240 584 Q 520 612 800 574" stroke="#0a0f13" stroke-width="20" fill="none" opacity="0.5"/>

  <!-- mooring lines -->
  <path d="M 176 420 Q 96 470 40 612" stroke="#d8d2c4" stroke-width="3" fill="none" opacity="0.7"/>

  <!-- on camera flash falloff -->
  <rect width="${W}" height="${H}" fill="url(#flash)"/>

  <!-- vignette -->
  <rect width="${W}" height="${H}" fill="none"/>
  <text x="${W - 24}" y="${H - 22}" text-anchor="end" font-family="monospace"
        font-size="21" fill="#ffb64a" opacity="0.85">2026-03-14 02:41</text>
</svg>`;

const base = await sharp(Buffer.from(svg)).png().toBuffer();

// Real sensor grain. This is the part that makes the test honest.
const grain = await sharp({
  create: {
    width: W,
    height: H,
    channels: 3,
    background: { r: 0, g: 0, b: 0 },
    noise: { type: "gaussian", mean: 128, sigma: 26 },
  },
})
  .png()
  .toBuffer();

const out = await sharp(base)
  .composite([{ input: grain, blend: "overlay" }])
  .blur(0.4) // low shutter speed, handheld
  .jpeg({ quality: 74, chromaSubsampling: "4:2:0" })
  .toBuffer();

await mkdir("public/lab", { recursive: true });
await writeFile("public/lab/boat-night.jpg", out);

const meta = await sharp(out).metadata();
console.log(`wrote public/lab/boat-night.jpg  ${meta.width}x${meta.height}  ${(out.length / 1024).toFixed(0)}kb`);
