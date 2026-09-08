/**
 * Builds the two textures the room cannot fake with a flat colour.
 *
 * 1. Cork, for the board. This is the surface the whole game happens on, so it
 *    has to read as real cork and not as brown plastic.
 * 2. The view out of the window: neon and palms, thrown badly out of focus.
 *    ART.md is firm that the neon lives OUTSIDE, behind the board. That contrast
 *    (warm dim room, cold neon outside) is the whole look.
 *
 * Colours come from the palette table in ART.md.
 *
 * Run: node scripts/make-room-textures.mjs
 */
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";

await mkdir("public/room", { recursive: true });

/* ---------------------------------------------------------------- */
/* cork                                                              */
/* ---------------------------------------------------------------- */

const CORK = 1024;
// Deterministic randomness so the texture is the same on every build.
let seed = 20260914;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

// Big soft blotches first: real cork board is unevenly bleached in patches.
const blotches = [];
for (let i = 0; i < 46; i++) {
  const x = rnd() * CORK;
  const y = rnd() * CORK;
  const r = 40 + rnd() * 130;
  const col = rnd() < 0.5 ? "#8d6335" : "#bb8d55";
  blotches.push(
    `<ellipse cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" rx="${r.toFixed(0)}" ry="${(r * (0.6 + rnd() * 0.6)).toFixed(0)}" fill="${col}" opacity="0.28"/>`,
  );
}

// Then the granules. These need to be big and high contrast — at 2.6 metres
// across on the wall, fine grain just averages out into flat brown and the
// board stops looking like a board.
const grains = [];
for (let i = 0; i < 5200; i++) {
  const x = rnd() * CORK;
  const y = rnd() * CORK;
  const rx = 3 + rnd() * 12;
  const ry = 2.5 + rnd() * 8;
  const rot = rnd() * 180;
  const dark = rnd();
  const col = dark < 0.42 ? "#7a5730" : dark < 0.76 ? "#c09761" : "#5f4324";
  const op = 0.2 + rnd() * 0.4;
  grains.push(
    `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" ` +
      `transform="rotate(${rot.toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})" fill="${col}" opacity="${op.toFixed(2)}"/>`,
  );
}

const corkSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CORK}" height="${CORK}">
  <rect width="${CORK}" height="${CORK}" fill="#9e7448"/>
  ${blotches.join("")}
  ${grains.join("")}
</svg>`;

const corkNoise = await sharp({
  create: {
    width: CORK,
    height: CORK,
    channels: 3,
    background: { r: 0, g: 0, b: 0 },
    noise: { type: "gaussian", mean: 128, sigma: 18 },
  },
})
  .png()
  .toBuffer();

const cork = await sharp(Buffer.from(corkSvg))
  .composite([{ input: corkNoise, blend: "overlay" }])
  .blur(0.3)
  .jpeg({ quality: 80 })
  .toBuffer();
await writeFile("public/room/cork.jpg", cork);

/* ---------------------------------------------------------------- */
/* out of the window                                                 */
/* ---------------------------------------------------------------- */

const NW = 1024;
const NH = 1024;

// A few palm silhouettes: trunk plus fronds, as rough shapes. They get blurred
// into mush anyway, so they only need the right outline.
function palm(cx, base, scale) {
  const parts = [`<rect x="${cx - 5 * scale}" y="${base - 250 * scale}" width="${10 * scale}" height="${250 * scale}" fill="#05070a"/>`];
  for (let i = 0; i < 7; i++) {
    const a = -160 + i * 26 + (rnd() * 10 - 5);
    parts.push(
      `<ellipse cx="${cx}" cy="${base - 250 * scale}" rx="${95 * scale}" ry="${13 * scale}" ` +
        `transform="rotate(${a} ${cx} ${base - 250 * scale})" fill="#05070a"/>`,
    );
  }
  return parts.join("");
}

const neonSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${NW}" height="${NH}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0a0f1a"/>
      <stop offset="60%" stop-color="#241326"/>
      <stop offset="100%" stop-color="#3a1a2a"/>
    </linearGradient>
  </defs>
  <rect width="${NW}" height="${NH}" fill="url(#sky)"/>

  <!-- distant neon signs and street lights -->
  <ellipse cx="210" cy="470" rx="120" ry="52" fill="#ff3d7f" opacity="0.95"/>
  <ellipse cx="700" cy="415" rx="150" ry="44" fill="#2ee6c1" opacity="0.8"/>
  <ellipse cx="880" cy="560" rx="70" ry="70" fill="#ff3d7f" opacity="0.6"/>
  <ellipse cx="430" cy="600" rx="60" ry="26" fill="#ffb457" opacity="0.85"/>
  <ellipse cx="90" cy="640" rx="46" ry="22" fill="#ffb457" opacity="0.6"/>
  <rect x="640" y="470" width="14" height="150" fill="#2ee6c1" opacity="0.5"/>

  <!-- wet road glow low down -->
  <ellipse cx="512" cy="900" rx="520" ry="90" fill="#ff3d7f" opacity="0.22"/>

  ${palm(160, 900, 1.25)}
  ${palm(560, 960, 1.0)}
  ${palm(930, 880, 1.45)}
</svg>`;

const neon = await sharp(Buffer.from(neonSvg))
  .blur(26) // thrown badly out of focus, exactly as ART.md asks
  .jpeg({ quality: 82 })
  .toBuffer();
await writeFile("public/room/window-view.jpg", neon);

console.log(
  `cork.jpg ${(cork.length / 1024).toFixed(0)}kb · window-view.jpg ${(neon.length / 1024).toFixed(0)}kb`,
);
