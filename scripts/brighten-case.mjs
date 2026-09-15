/**
 * Lifts the case photos so a player can actually see what they are looking for.
 *
 * The set came out of the generator looking like real 2am flash photos, which
 * was the goal — but it made the game unplayable. Half the clues were sitting
 * in shadow you could not read on a normal laptop screen.
 *
 * So: lift the shadows, keep the highlights. `linear(a, b)` maps every channel
 * to a*x + b, which raises the black point without touching what is already
 * bright, then a gentle brightness and saturation nudge. It still reads as
 * night. You can just see into it now.
 *
 * Originals stay in art-raw/, so this can be re-run or dialled back.
 *
 * Run: node scripts/brighten-case.mjs [case-id]
 */
import sharp from "sharp";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const caseId = process.argv[2] ?? "01";
const DIR = `public/cases/${caseId}`;
const BACKUP = `art-raw/${caseId}-original`;

/** Photos taken in daylight need much less help than the 2am ones. */
const DAYLIGHT = new Set(["sunset", "tourists", "storm"]);

await mkdir(BACKUP, { recursive: true });

const files = (await readdir(DIR)).filter((f) => f.endsWith(".jpg")).sort();
if (!files.length) {
  console.error(`no photos in ${DIR}`);
  process.exit(1);
}

for (const file of files) {
  const id = file.replace(/\.jpg$/, "");
  const backup = `${BACKUP}/${file}`;

  // First run backs the original up; later runs always work FROM that backup,
  // so brightening twice can never stack into a washed-out mess.
  if (!existsSync(backup)) await writeFile(backup, await readFile(`${DIR}/${file}`));

  const day = DAYLIGHT.has(id);
  const out = await sharp(backup)
    .linear(day ? 1.04 : 1.22, day ? 6 : 26) // raise the black point
    .modulate({ brightness: day ? 1.03 : 1.16, saturation: 1.08 })
    .jpeg({ quality: 84, chromaSubsampling: "4:2:0" })
    .toBuffer();

  await writeFile(`${DIR}/${file}`, out);
  console.log(`${id.padEnd(16)} ${day ? "daylight" : "night   "}  ${(out.length / 1024).toFixed(0)}kb`);
}

console.log(`\n${files.length} photos lifted. Originals in ${BACKUP}/`);
