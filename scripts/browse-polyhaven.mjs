/**
 * Look before you download.
 *
 * Poly Haven has 521 CC0 models and most of them are wrong for a damp room in
 * Leonida. This pulls the thumbnails for a shortlist and lays them out in one
 * sheet, with the 1k download size printed under each, so the choice is made by
 * eye and by weight rather than by guessing from a filename.
 *
 * Run: node scripts/browse-polyhaven.mjs <search-term> [more terms...]
 */
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";

const terms = process.argv.slice(2);
if (!terms.length) {
  console.error("usage: node scripts/browse-polyhaven.mjs <term> [term...]");
  process.exit(1);
}

const all = await (await fetch("https://api.polyhaven.com/assets?type=models")).json();

const re = new RegExp(terms.join("|"), "i");
const hits = Object.entries(all)
  .filter(([id, a]) => re.test(id) || re.test((a.tags || []).join(" ")) || re.test(a.name || ""))
  .slice(0, 24);

if (!hits.length) {
  console.log("nothing matched");
  process.exit(0);
}

await mkdir("art-raw/ph-thumbs", { recursive: true });

const CELL_W = 300;
const CELL_H = 200;
const LABEL = 34;
const PAD = 8;
const COLS = 4;

const cells = [];
for (const [id, asset] of hits) {
  // 1k gltf weight decides whether we can afford it at all.
  let kb = "?";
  try {
    const files = await (await fetch(`https://api.polyhaven.com/files/${id}`)).json();
    const g = files?.gltf?.["1k"]?.gltf;
    if (g) {
      const total = g.size + Object.values(g.include || {}).reduce((n, f) => n + f.size, 0);
      kb = (total / 1024).toFixed(0);
    }
  } catch {
    /* keep going, the picture matters more */
  }

  let thumb;
  try {
    const res = await fetch(`https://cdn.polyhaven.com/asset_img/thumbs/${id}.png?width=${CELL_W}&height=${CELL_H}`);
    thumb = Buffer.from(await res.arrayBuffer());
    await sharp(thumb).metadata();
  } catch {
    thumb = null;
  }
  cells.push({ id, name: asset.name, polys: asset.polycount, kb, thumb });
}

const rows = Math.ceil(cells.length / COLS);
const W = COLS * (CELL_W + PAD) + PAD;
const H = rows * (CELL_H + LABEL + PAD) + PAD;

const composites = [];
for (let i = 0; i < cells.length; i++) {
  const c = cells[i];
  const x = PAD + (i % COLS) * (CELL_W + PAD);
  const y = PAD + ((i / COLS) | 0) * (CELL_H + LABEL + PAD);

  if (c.thumb) {
    composites.push({
      input: await sharp(c.thumb).resize(CELL_W, CELL_H, { fit: "cover" }).toBuffer(),
      top: y,
      left: x,
    });
  }
  const line1 = c.id;
  const line2 = `${c.kb}kb · ${c.polys ?? "?"} tris`;
  composites.push({
    input: Buffer.from(
      `<svg width="${CELL_W}" height="${LABEL}">
        <text x="2" y="14" font-family="monospace" font-size="13" fill="#efe7d8">${line1}</text>
        <text x="2" y="29" font-family="monospace" font-size="12" fill="#a3a09a">${line2}</text>
      </svg>`,
    ),
    top: y + CELL_H + 2,
    left: x,
  });
}

const sheet = await sharp({
  create: { width: W, height: H, channels: 3, background: { r: 13, g: 11, b: 9 } },
})
  .composite(composites)
  .jpeg({ quality: 88 })
  .toBuffer();

const outName = `art-raw/ph-${terms.join("-").replace(/[^a-z0-9-]/gi, "")}.jpg`;
await writeFile(outName, sheet);
console.log(`${cells.length} candidates -> ${outName}`);
for (const c of cells) console.log(`  ${c.id.padEnd(30)} ${String(c.kb).padStart(6)}kb  ${c.polys ?? "?"} tris`);
