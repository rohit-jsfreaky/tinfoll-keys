/**
 * Saves a whole batch of generated photos at once.
 *
 * Input is the JSON the browser wrote out: { "<photo-id>": "data:image/...", ... }.
 * Same rules as save-generated.mjs — raw kept in art-raw/, shipped copy
 * normalised to 1024x768 JPEG in public/cases/<case>/.
 *
 * Run: node scripts/save-batch.mjs <batch-json> <case-id>
 */
import sharp from "sharp";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const [batchFile, caseId] = process.argv.slice(2);
if (!batchFile || !caseId) {
  console.error("usage: node scripts/save-batch.mjs <batch-json> <case-id>");
  process.exit(1);
}

const WIDTH = 1024;
const HEIGHT = 768;

const batch = JSON.parse(await readFile(batchFile, "utf8"));
await mkdir(`art-raw/${caseId}`, { recursive: true });
await mkdir(`public/cases/${caseId}`, { recursive: true });

for (const [photoId, dataUrl] of Object.entries(batch)) {
  if (!dataUrl) {
    console.log(`${photoId}: MISSING — not found on the page`);
    continue;
  }
  const comma = dataUrl.indexOf(",");
  const bytes = Buffer.from(comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl, "base64");

  await writeFile(`art-raw/${caseId}/${photoId}.png`, bytes);
  const before = await sharp(bytes).metadata();

  const out = await sharp(bytes)
    .resize(WIDTH, HEIGHT, { fit: "cover", position: "centre" })
    .jpeg({ quality: 82, chromaSubsampling: "4:2:0" })
    .toBuffer();
  await writeFile(`public/cases/${caseId}/${photoId}.jpg`, out);

  console.log(
    `${photoId}: ${before.width}x${before.height} -> ${WIDTH}x${HEIGHT}  ${(out.length / 1024).toFixed(0)}kb`,
  );
}
