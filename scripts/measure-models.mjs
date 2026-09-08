/**
 * Prints the real bounding box of every shipped model.
 *
 * Downloaded models arrive at arbitrary scales and arbitrary origins, so
 * placing them by guessing a `fitHeight` wastes a screenshot cycle per prop.
 * This measures them once so the numbers in props.tsx are chosen, not guessed.
 *
 * Run: node scripts/measure-models.mjs
 */
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { getBounds } from "@gltf-transform/core";
import { readdir } from "node:fs/promises";

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const dirs = ["public/models/sk", "public/models/ph"];

for (const dir of dirs) {
  const files = (await readdir(dir)).filter((f) => f.endsWith(".glb")).sort();
  console.log(`\n--- ${dir} ---`);
  for (const f of files) {
    try {
      const doc = await io.read(`${dir}/${f}`);
      const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
      const b = getBounds(scene);
      const size = [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]];
      console.log(
        `${f.replace(".glb", "").padEnd(42)} ${size.map((v) => v.toFixed(2).padStart(9)).join(" x ")}`,
      );
    } catch (e) {
      console.log(`${f.padEnd(42)} FAILED ${String(e).slice(0, 60)}`);
    }
  }
}
