/**
 * Draws every hotspot rectangle onto its photo so they can be eyeballed.
 *
 * Hotspot rects are guessed from looking at a photo, and a rect that is 5% off
 * is a clue the player can never find. This renders the truth: red box over the
 * thing the player is supposed to circle. If the box is not on the thing, the
 * rect is wrong.
 *
 * Run: node scripts/check-hotspots.mjs <case-id>
 */
import sharp from "sharp";
import { access, readFile, writeFile } from "node:fs/promises";

const caseId = process.argv[2] || "01";
const file = JSON.parse(await readFile(`public/cases/${caseId}/case.json`, "utf8"));

const CELL_W = 460;
const CELL_H = 345;
const LABEL = 24;
const PAD = 10;
const COLS = 3;

const exists = async (p) => access(p).then(() => true, () => false);

const withSpots = [];
const missing = [];
for (const p of file.photos.filter((x) => x.hotspots.length)) {
  if (await exists(`public/cases/${caseId}/${p.id}.jpg`)) withSpots.push(p);
  else missing.push(p.id);
}
if (missing.length) console.log(`no photo yet, skipped: ${missing.join(", ")}`);
const rows = Math.ceil(withSpots.length / COLS);
const W = COLS * (CELL_W + PAD) + PAD;
const H = rows * (CELL_H + LABEL + PAD) + PAD;

const composites = [];
for (let i = 0; i < withSpots.length; i++) {
  const photo = withSpots[i];
  const col = i % COLS;
  const row = (i / COLS) | 0;
  const x = PAD + col * (CELL_W + PAD);
  const y = PAD + row * (CELL_H + LABEL + PAD);

  const boxes = photo.hotspots
    .map((h) => {
      const [rx, ry, rw, rh] = h.rect;
      return (
        `<rect x="${rx * CELL_W}" y="${ry * CELL_H}" width="${rw * CELL_W}" height="${rh * CELL_H}" ` +
        `fill="none" stroke="#ff2d20" stroke-width="3"/>` +
        `<text x="${rx * CELL_W + 4}" y="${ry * CELL_H - 5}" font-family="monospace" font-size="14" fill="#ff2d20">${h.id}</text>`
      );
    })
    .join("");

  const base = await sharp(`public/cases/${caseId}/${photo.id}.jpg`)
    .resize(CELL_W, CELL_H, { fit: "cover" })
    .composite([
      { input: Buffer.from(`<svg width="${CELL_W}" height="${CELL_H}">${boxes}</svg>`), top: 0, left: 0 },
    ])
    .toBuffer();

  composites.push({ input: base, top: y, left: x });
  composites.push({
    input: Buffer.from(
      `<svg width="${CELL_W}" height="${LABEL}"><text x="2" y="17" font-family="monospace" font-size="15" fill="#efe7d8">${photo.id}</text></svg>`,
    ),
    top: y + CELL_H + 3,
    left: x,
  });
}

const sheet = await sharp({
  create: { width: W, height: H, channels: 3, background: { r: 13, g: 11, b: 9 } },
})
  .composite(composites)
  .jpeg({ quality: 88 })
  .toBuffer();

await writeFile(`art-raw/hotspots-${caseId}.jpg`, sheet);
console.log(
  `${withSpots.length} photos, ${withSpots.reduce((n, p) => n + p.hotspots.length, 0)} hotspots ` +
    `-> art-raw/hotspots-${caseId}.jpg`,
);
