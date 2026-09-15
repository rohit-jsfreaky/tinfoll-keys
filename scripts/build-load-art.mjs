/**
 * Turns the raw loading-screen panels into web-sized JPEGs.
 *
 * The panels come out of image generation as 1024px+ PNGs, several megabytes
 * each. They are the first thing anybody downloads, so they are also the worst
 * place to ship a PNG — the loading screen would itself need a loading screen.
 *
 * Portraits are kept taller than they are wide and landscapes wider, because
 * the screen crops them differently.
 *
 * Run: node scripts/build-load-art.mjs
 */

import sharp from "sharp";
import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";

const IN = "art-raw/shots";
const OUT = "public/load";

const files = (await readdir(IN).catch(() => [])).filter((f) => f.startsWith("load-"));
if (!files.length) {
  console.log("no load-*.png in art-raw/shots yet — generate the panels first.");
  process.exit(0);
}

await mkdir(OUT, { recursive: true });

for (const f of files) {
  const id = path.parse(f).name;
  const src = path.join(IN, f);
  const meta = await sharp(src).metadata();
  const wide = (meta.width ?? 0) > (meta.height ?? 0);

  const out = path.join(OUT, `${id}.jpg`);
  const info = await sharp(src)
    // Wide plates carry the whole yard, so they get the extra pixels. The
    // portraits are only ever seen cropped to a face and a shoulder.
    .resize(wide ? 1440 : 1100, wide ? 960 : 1650, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 78, mozjpeg: true, progressive: true })
    .toFile(out);

  console.log(
    `${id.padEnd(14)} ${meta.width}x${meta.height} -> ${info.width}x${info.height}  ${(info.size / 1024).toFixed(0)}kb`,
  );
}
