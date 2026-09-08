/**
 * Builds one contact sheet of every photo in a case.
 *
 * ART.md's real quality bar is not "is this photo good" but "do these all look
 * like the same night, the same phone, the same person". You can only judge that
 * with the whole set side by side, so this lays them out in a grid with their
 * ids under them.
 *
 * Run: node scripts/contact-sheet.mjs <case-id>
 */
import sharp from "sharp";
import { readdir, writeFile } from "node:fs/promises";

const caseId = process.argv[2] || "01";
const DIR = `public/cases/${caseId}`;
const COLS = 4;
const CELL_W = 340;
const CELL_H = 255;
const LABEL = 26;
const PAD = 10;

const files = (await readdir(DIR)).filter((f) => f.endsWith(".jpg")).sort();
if (!files.length) {
  console.error(`no photos in ${DIR}`);
  process.exit(1);
}

const rows = Math.ceil(files.length / COLS);
const W = COLS * (CELL_W + PAD) + PAD;
const H = rows * (CELL_H + LABEL + PAD) + PAD;

const composites = [];
for (let i = 0; i < files.length; i++) {
  const col = i % COLS;
  const row = (i / COLS) | 0;
  const x = PAD + col * (CELL_W + PAD);
  const y = PAD + row * (CELL_H + LABEL + PAD);

  const thumb = await sharp(`${DIR}/${files[i]}`).resize(CELL_W, CELL_H, { fit: "cover" }).toBuffer();
  composites.push({ input: thumb, top: y, left: x });

  const name = files[i].replace(/\.jpg$/, "");
  const label = Buffer.from(
    `<svg width="${CELL_W}" height="${LABEL}"><text x="2" y="18" font-family="monospace" font-size="16" fill="#efe7d8">${name}</text></svg>`,
  );
  composites.push({ input: label, top: y + CELL_H + 3, left: x });
}

const sheet = await sharp({
  create: { width: W, height: H, channels: 3, background: { r: 13, g: 11, b: 9 } },
})
  .composite(composites)
  .jpeg({ quality: 86 })
  .toBuffer();

await writeFile(`art-raw/contact-sheet-${caseId}.jpg`, sheet);
console.log(`${files.length} photos -> art-raw/contact-sheet-${caseId}.jpg (${W}x${H})`);
