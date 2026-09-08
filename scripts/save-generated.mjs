/**
 * Takes the base64 dump the browser wrote out, and turns it into a case photo.
 *
 * Every photo in a case must be the same pixel size, because hit detection
 * compares the saved image against this exact file (see ART.md, "After
 * generating"). So everything lands at 1024x768 JPEG.
 *
 * The untouched generation is kept in art-raw/ so a photo can be re-cropped
 * later without going back to the generator.
 *
 * Run: node scripts/save-generated.mjs <b64-file> <case-id> <photo-id>
 */
import sharp from "sharp";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const [b64File, caseId, photoId] = process.argv.slice(2);
if (!b64File || !caseId || !photoId) {
  console.error("usage: node scripts/save-generated.mjs <b64-file> <case-id> <photo-id>");
  process.exit(1);
}

const WIDTH = 1024;
const HEIGHT = 768;

let raw = await readFile(b64File, "utf8");
raw = raw.trim();
// The browser tool writes the value as a JSON string.
if (raw.startsWith('"')) raw = JSON.parse(raw);
const comma = raw.indexOf(",");
const bytes = Buffer.from(comma >= 0 ? raw.slice(comma + 1) : raw, "base64");

await mkdir(`art-raw/${caseId}`, { recursive: true });
await mkdir(`public/cases/${caseId}`, { recursive: true });

const rawPath = `art-raw/${caseId}/${photoId}.png`;
await writeFile(rawPath, bytes);

const before = await sharp(bytes).metadata();

const outPath = `public/cases/${caseId}/${photoId}.jpg`;
const out = await sharp(bytes)
  .resize(WIDTH, HEIGHT, { fit: "cover", position: "centre" })
  .jpeg({ quality: 82, chromaSubsampling: "4:2:0" })
  .toBuffer();
await writeFile(outPath, out);

console.log(
  `${photoId}: ${before.width}x${before.height} -> ${WIDTH}x${HEIGHT}  ` +
    `${(out.length / 1024).toFixed(0)}kb  ${outPath}`,
);
