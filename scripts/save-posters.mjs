/**
 * Saves the generated wall posters into public/room/.
 *
 * These are original artwork made for this project — Leonida-flavoured, not
 * copies of anything Rockstar published. That matters: the challenge rules say
 * to avoid leaked or unauthorised GTA VI material, so the posters borrow the
 * setting and the palette and nothing else.
 *
 * Portrait 2:3, and small — they hang on a side wall and are never the subject.
 *
 * Run: node scripts/save-posters.mjs <batch-json>
 */
import sharp from "sharp";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const batchFile = process.argv[2];
if (!batchFile) {
  console.error("usage: node scripts/save-posters.mjs <batch-json>");
  process.exit(1);
}

const W = 512;
const H = 768;

const batch = JSON.parse(await readFile(batchFile, "utf8"));
await mkdir("public/room/posters", { recursive: true });

for (const [id, dataUrl] of Object.entries(batch)) {
  if (!dataUrl) {
    console.log(`${id}: MISSING`);
    continue;
  }
  const comma = dataUrl.indexOf(",");
  const bytes = Buffer.from(comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl, "base64");
  const before = await sharp(bytes).metadata();

  const out = await sharp(bytes)
    .resize(W, H, { fit: "cover", position: "centre" })
    .jpeg({ quality: 84 })
    .toBuffer();
  await writeFile(`public/room/posters/${id}.jpg`, out);
  console.log(`${id}: ${before.width}x${before.height} -> ${W}x${H}  ${(out.length / 1024).toFixed(0)}kb`);
}
