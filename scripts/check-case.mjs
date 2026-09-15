/**
 * Preflight for a case. Run it before every deploy.
 *
 * game.test.ts proves the rules are right. This proves the *content* is there:
 * every photo has an image on disk, every evidence photo has a hotspot inside
 * the frame, every clue has a voice line, and nothing is left over from a case
 * that got rewritten. A missing jpg is a broken image in front of a judge and
 * no unit test will ever catch it.
 *
 * Run: node scripts/check-case.mjs [case-id]
 * Exits non-zero if anything is wrong, so it can gate a build.
 */
import { access, readdir, readFile } from "node:fs/promises";

const caseId = process.argv[2] || "01";
const dir = `public/cases/${caseId}`;
const file = JSON.parse(await readFile(`${dir}/case.json`, "utf8"));

const problems = [];
const notes = [];
const exists = (p) => access(p).then(() => true, () => false);

const ids = file.photos.map((p) => p.id);
const byRole = (r) => file.photos.filter((p) => p.role === r);

// --- the photos ------------------------------------------------------------
for (const photo of file.photos) {
  if (!(await exists(`${dir}/${photo.id}.jpg`))) {
    problems.push(`${photo.id}: no image at ${dir}/${photo.id}.jpg`);
  }
  if (!photo.caption?.trim()) problems.push(`${photo.id}: no caption`);

  for (const h of photo.hotspots ?? []) {
    const [x, y, w, h2] = h.rect ?? [];
    if ([x, y, w, h2].some((n) => typeof n !== "number")) {
      problems.push(`${photo.id}/${h.id}: rect is not four numbers`);
      continue;
    }
    if (w <= 0 || h2 <= 0) problems.push(`${photo.id}/${h.id}: rect has no area`);
    if (x < 0 || y < 0 || x + w > 1.0001 || y + h2 > 1.0001) {
      problems.push(`${photo.id}/${h.id}: rect falls outside the photo`);
    }
    // A rect this small is a pixel hunt, not a clue.
    if (w * h2 < 0.004) notes.push(`${photo.id}/${h.id}: rect is only ${(w * h2 * 100).toFixed(1)}% of the frame`);
    if (!h.clue?.trim()) problems.push(`${photo.id}/${h.id}: no clue text`);
    // A hotspot with no hint is one a stuck player can never be helped past.
    if (!h.hint?.trim()) problems.push(`${photo.id}/${h.id}: no hint text`);
  }
}

// --- the shape of the case -------------------------------------------------
for (const p of file.photos) {
  const spots = (p.hotspots ?? []).length;
  if (!["crime", "turn", "context"].includes(p.role)) problems.push(`${p.id}: bad role "${p.role}"`);
  if (!["cal", "mateo"].includes(p.voice)) problems.push(`${p.id}: bad voice "${p.voice}"`);
  if (p.role !== "context" && spots === 0) {
    problems.push(`${p.id}: ${p.role} photo with nothing to find on it`);
  }
  if (p.role === "context" && spots > 0) {
    problems.push(`${p.id}: context photo with a hotspot — context must pin freely`);
  }
}

if (byRole("crime").length !== 6) problems.push(`${byRole("crime").length} crime photos, expected 6`);
if (byRole("turn").length < 4) problems.push(`only ${byRole("turn").length} turn photos — the chain is too short`);
if (new Set(ids).size !== ids.length) problems.push("duplicate photo ids");
if (!file.endings?.win?.trim() || !file.endings?.lost?.trim()) problems.push("an ending is empty");
if (!(file.story ?? []).length) problems.push("no story pages");

const brief = file.briefing;
if (!brief) {
  problems.push("no briefing — a player would open the game not knowing who they are");
} else {
  if (!brief.title?.trim()) problems.push("the briefing has no title");
  if ((brief.blocks ?? []).length < 4) {
    problems.push(`briefing has ${(brief.blocks ?? []).length} blocks — needs who you are, who he is, what happened, and what he wants`);
  }
  for (const b of brief.blocks ?? []) {
    if (!b.head?.trim() || !b.body?.trim()) problems.push("a briefing block is empty");
  }
}

// --- the accusation, which is the only judged moment ------------------------
const allSpots = file.photos.flatMap((p) => (p.hotspots ?? []).map((h) => h.id));
for (const id of file.required ?? []) {
  if (!allSpots.includes(id)) problems.push(`required clue "${id}" is not a hotspot anywhere`);
}
if (!(file.required ?? []).length) problems.push("nothing is required before the accusation — a judge will miss the story");

const acc = file.accusation;
if (!acc) {
  problems.push("no accusation — there is nothing to judge");
} else {
  if (!acc.lead?.trim()) problems.push("the accusation has no lead line");
  const slotIds = acc.slots.map((s) => s.id);
  for (const slot of acc.slots) {
    if (!slot.question?.trim()) problems.push(`${slot.id}: no question`);
    if (slot.options.length < 2) problems.push(`${slot.id}: needs at least two options`);
    if (!slot.options.some((o) => o.id === slot.answer)) {
      problems.push(`${slot.id}: answer "${slot.answer}" is not one of its options`);
    }
    for (const o of slot.options) if (!o.text?.trim()) problems.push(`${slot.id}/${o.id}: no text`);
  }
  const inTemplate = [...acc.template.matchAll(/\{([\w-]+)\}/g)].map((m) => m[1]);
  for (const id of slotIds) {
    if (!inTemplate.includes(id)) problems.push(`slot "${id}" has no blank in the sentence`);
  }
  for (const id of inTemplate) {
    if (!slotIds.includes(id)) problems.push(`the sentence has a blank "{${id}}" with no slot`);
  }
  // Five stars is WASTED, so a single all-wrong submission must not be fatal —
  // the player has to get a second go at it.
  if (acc.slots.length >= 5) problems.push("five or more slots: one wrong sentence would end the game outright");
}

// --- the voice -------------------------------------------------------------
const vo = [];
(file.story ?? []).forEach((_, i) => vo.push(`story-${i + 1}`));
// An alternate hotspot borrows another's line, so it needs no recording.
for (const p of file.photos)
  for (const h of p.hotspots ?? []) if (!h.voiceAs) vo.push(`clue-${h.id}`);
vo.push("win", "lost", "intro", "not-yet", "accuse-lead", "accuse-short", "yard-dirty");
for (const id of vo) {
  if (!(await exists(`public/vo/${id}.mp3`))) problems.push(`no voice line: public/vo/${id}.mp3`);
}

// --- leftovers -------------------------------------------------------------
const onDisk = (await readdir(dir)).filter((f) => f.endsWith(".jpg")).map((f) => f.slice(0, -4));
const orphans = onDisk.filter((f) => !ids.includes(f));
if (orphans.length) notes.push(`not used by this case: ${orphans.join(", ")}`);

// --- say so ----------------------------------------------------------------
console.log(`case ${caseId}: ${file.title}`);
console.log(
  `  ${file.photos.length} photos · ${byRole("crime").length} crime · ${byRole("turn").length} turn · ` +
  `${byRole("context").length} context · ${vo.length} voice lines`,
);
for (const n of notes) console.log(`  note: ${n}`);
if (problems.length) {
  console.log("");
  for (const p of problems) console.log(`  PROBLEM: ${p}`);
  console.log(`\n${problems.length} problem(s).`);
  process.exit(1);
}
console.log("\nall good.");
