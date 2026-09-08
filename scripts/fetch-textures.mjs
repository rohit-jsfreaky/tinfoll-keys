/**
 * Downloads CC0 surface textures from Poly Haven.
 *
 * Textures use a different shape to models: the files endpoint hands back one
 * entry per map (Diffuse, nor_gl, Rough, AO...) rather than a single glTF with
 * includes. We only take the maps three.js actually uses for a matte surface,
 * at 1k — the walls and floor are seen at an angle across a dim room and 2k
 * would cost megabytes for nothing.
 *
 * Run: node scripts/fetch-textures.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";

const WANTED = [
  ["large_floor_tiles_02", "the floor"],
  ["beige_wall_001", "the walls"],
];

/** Poly Haven's key -> the name three.js knows it by. */
const MAPS = {
  Diffuse: "diff",
  nor_gl: "nor",
  Rough: "rough",
  AO: "ao",
};

const OUT = "public/textures";
let total = 0;
const got = [];

for (const [id, why] of WANTED) {
  const files = await (await fetch(`https://api.polyhaven.com/files/${id}`)).json();
  const info = await (await fetch(`https://api.polyhaven.com/info/${id}`)).json();

  await mkdir(`${OUT}/${id}`, { recursive: true });
  const saved = [];

  for (const [key, short] of Object.entries(MAPS)) {
    const entry = files?.[key]?.["1k"]?.jpg ?? files?.[key]?.["1k"]?.png;
    if (!entry?.url) continue;

    const ext = entry.url.endsWith(".png") ? "png" : "jpg";
    const path = `${OUT}/${id}/${short}.${ext}`;
    if (existsSync(path)) {
      total += statSync(path).size;
      saved.push(short);
      continue;
    }
    const res = await fetch(entry.url);
    if (!res.ok) continue;
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(path, buf);
    total += buf.length;
    saved.push(short);
  }

  const authors = Object.keys(info?.authors || {}).join(", ") || "Poly Haven";
  got.push({ id, why, authors, maps: saved });
  console.log(`${id.padEnd(24)} ${saved.join(", ")}`);
}

console.log(`\ntotal ${(total / 1024 / 1024).toFixed(2)}MB`);
console.log(got.map((g) => `| [${g.id}](https://polyhaven.com/a/${g.id}) | ${g.authors} | ${g.why} |`).join("\n"));
