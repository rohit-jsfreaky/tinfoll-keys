/**
 * Saves generated photos that are already on disk.
 *
 * save-batch.mjs takes data URLs pasted out of the browser; this takes files,
 * which is what you get when Playwright downloads them straight from the chat.
 * Same rules either way: the original is kept in art-raw/<case>/ and the copy
 * that ships is normalised to one size, so every photo in the box has the same
 * shape and the hit detector has one grid to work against.
 *
 * Run: node scripts/save-files.mjs <case-id> <file>=<photo-id> [...]
 *   node scripts/save-files.mjs 01 art-raw/rescue/shot-1.png=takings-board
 */
import sharp from "sharp";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const [caseId, ...pairs] = process.argv.slice(2);
if (!caseId || pairs.length === 0) {
  console.error("usage: node scripts/save-files.mjs <case-id> <file>=<photo-id> [...]");
  process.exit(1);
}

const WIDTH = 1024;
const HEIGHT = 768;

await mkdir(`art-raw/${caseId}`, { recursive: true });
await mkdir(`public/cases/${caseId}`, { recursive: true });

for (const pair of pairs) {
  const at = pair.lastIndexOf("=");
  if (at < 0) {
    console.error(`skipping "${pair}" — expected <file>=<photo-id>`);
    continue;
  }
  const file = pair.slice(0, at);
  const photoId = pair.slice(at + 1);

  const bytes = await readFile(file);
  const before = await sharp(bytes).metadata();

  await writeFile(`art-raw/${caseId}/${photoId}.png`, bytes);
  const out = await sharp(bytes)
    .resize(WIDTH, HEIGHT, { fit: "cover", position: "centre" })
    .jpeg({ quality: 82, chromaSubsampling: "4:2:0" })
    .toBuffer();
  await writeFile(`public/cases/${caseId}/${photoId}.jpg`, out);

  console.log(
    `${photoId}: ${before.width}x${before.height} -> ${WIDTH}x${HEIGHT}  ${(out.length / 1024).toFixed(0)}kb`,
  );
}
