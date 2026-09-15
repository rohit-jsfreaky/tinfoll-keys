# Tinfoil Keys

**A detective game where you solve the case by drawing on the evidence.**

Built for the *Build With React Image Editor Challenge* by Unlayer.

> Everyone else will use the image editor to **decorate** — add a filter, add text,
> download a poster. Here, drawing is how you **point**. A red circle is not
> decoration. It is an accusation. The editor is not the output. It is the
> controller.

<!-- screenshots: docs/room.png · docs/board.png · docs/editor.png · docs/wasted.png -->

## What it is

You are Mateo Ruiz, night-shift driver at a tow yard in Port Gellhorn. Your upstairs
neighbour is **Cal Hampton** — GTA VI's paranoid guy, the one Rockstar describes as
feeling "safest hanging at home, snooping on Coast Guard comms with a few beers and some
private browser tabs open." He has photographed your workplace for three weeks and he
calls you up to look at it:

> "You work there, Mateo. That's why you're in my flat at one in the morning."

Fourteen photographs of a 24-hour impound yard. You open one in the image editor and
**draw on the thing that looks wrong**. Get it right and Cal tells you what it is. The
same plate on two different cars. A stack of dealer plates in a tow yard. A supercar
inside a shipping container. A VIN cut out of a dashboard.

Cal is right about the yard. That is not the question.

The question is the older man in the grey shirt who is near every one of those cars, who
taught you to run the flatbed, and whose daughter's car was stolen in March and never
found. Cal thinks he is in on it.

At the end you state it as one sentence, with names in it. Every claim the photographs do
not support is a wanted star, and the game will not tell you **which** claim was wrong —
only how many. Five stars is **WASTED**.

Looking is free. The string is free. **Only the accusation is judged.**

## How React Image Editor is used

The editor is the only way to make progress. There is no other input for finding a clue.

The problem: `onSave` hands back a flattened image and nothing else. No layers, no
"the user drew a circle at x, y." So the game reads your intent by **comparing the saved
image against the original and finding which pixels changed.**

`src/lib/hit-detect.ts` does this in five steps:

1. Rasterise both images onto the same 512px grid.
2. Take the largest per-channel difference at every pixel, then a 3×3 blur so JPEG grain
   averages out while a pen stroke, which is a *run* of changed pixels, survives.
3. Threshold, dilate, flood-fill into blobs. Merge blobs that are one gesture — a circle
   drawn in two strokes should count as one accusation.
4. Test each blob against the photo's hotspot rectangles three ways, because people
   point three ways: scribble on it, ring it, or leave a rough blob across it.
5. Refuse a blob that covers most of the image. You cannot circle everything and win.

It runs in 30–65 ms. The threshold was set from a measured no-edit save, not guessed:
the editor's own re-encode moves the 99th-percentile pixel by **1**, so the noise floor
is effectively zero. Verified 10/10 on the test bench, then on the real case art.

This forces the toolset. Only **draw, text, shapes, stickers** are enabled. Crop and
resize change the dimensions and filter changes every pixel — any of the three would
make the diff meaningless. `features` is a remount-tier option, so it is set once before
mount and never toggled.

```tsx
<ImageEditor
  image={photo.src}
  options={{ theme: "dark", features: { imageEditor: { tools: {
    crop: false, resize: false, filter: false, frame: false,
    draw: true, text: true, shapes: true, stickers: true,
  } } } }}
  onSave={({ dataUrl }) => detectHits(photo.src, dataUrl, photo.hotspots)}
/>
```

The editor is a DOM component and cannot be painted into a WebGL canvas, so it opens as
a full-screen layer over the 3D room. That turned out to feel right: it reads as leaning
in close to a photo, the way inspecting an item works in a game.

## Controls

| do | how |
|---|---|
| look around | click once to capture the mouse, then move it · Esc releases |
| read the case | look at the paper on the wall, click |
| open the box | look at the box on the console, click |
| find a clue | pick a photo → MARK IT → draw on what looks wrong → Save |
| pin a photo | PIN TO BOARD |
| tie string | look at a pinned photo, click · look at another, click · costs nothing |
| look closely | right click a pinned photo to lift it off the board |
| accuse | NAME THEM, bottom of the screen, once you know who the man is |
| shut Cal up | CAL: ON, bottom left |
| on a phone | drag to look, tap to act |

## Technical notes

- **Next.js 16** (App Router), all client side. No backend, no database, no auth.
  Progress lives in `localStorage`. Deploys to Vercel in one click.
- **React Three Fiber 9** + drei on **three 0.185** for the room. Fixed camera, pointer
  lock, one raycast per frame against bounding boxes (not geometry) to keep the frame
  rate flat.
- **The rules are a pure module.** `src/lib/game.ts` has no React and no three.js in it.
  `src/lib/game.test.ts` runs 28 tests in under a second, including six against the real
  case file: it can be won, it can be lost, naming Luis is what loses it, every required
  clue exists, every accusation answer is one of its own options, and the sentence has a
  blank for every slot. `npx vitest run`.
- **You cannot win without the editor.** A photo that hides something will not go on the
  board until you have drawn on the right part of it (`canPin` in `game.ts`). The pen is
  the only door.
- **The game answers once, and it answers vaguely on purpose.** Scoring each piece of red
  string told the player exactly which connection was wrong, which turns a person into a
  search algorithm — they stop reasoning and start bisecting. So the string costs nothing
  now and the board is a scratchpad. The accusation is the only judged moment, and it
  returns a *count* of unsupported claims, never which ones. "Something in here is wrong"
  makes you look at the photographs again. "Slot three is wrong" makes you click.
- **No junk pile.** Photos are `crime`, `turn` or `context` — there is no pile of nothing.
  Context photos have nothing to find but they are how you learn who these people are,
  which is what makes the last question hurt. The old version split fourteen photos into
  six real and eight worthless, and the moment a mark landed you knew which pile you were
  in, so the second half of the game had no decision left in it.
- **A rail, deliberately.** After three crimes are proved the box quietly starts handing
  over the chain about Luis one photo at a time (`nextInChain`), and Cal will not let you
  name anybody until you have walked it. A judge has three minutes; one who reaches the
  accusation without that chain names the wrong man and leaves thinking the game had no
  story in it.
- **Assets.** 29 models from Sketchfab (CC BY), 12 from Poly Haven (CC0), two CC0
  textures. Every one was reprocessed with `@gltf-transform/cli` — textures to 1024px
  (512px for small props) as WebP, geometry simplified on the heavy ones. **264 MB of
  downloads ship as 17 MB.** Full attribution in [CREDITS.md](CREDITS.md).
- **The 14 photos are AI-generated** for this project — every pixel is ours, no Rockstar
  assets anywhere. They are shot as one man's surveillance: a cheap phone held inside a
  parked car, dashboard in frame, burned-in timestamp, crooked framing.
  The first set of this game was magenta-and-cyan neon on wet asphalt, which is a 1980s
  Miami Vice album cover and not GTA VI. Rockstar's Leonida is "the darkest side of the
  sunniest place in America" — so these are sun-weathered modern Florida instead: chain
  link with privacy slats, a portable office trailer with a window AC unit, tangled
  overhead cables, amber sodium floodlights and sick fluorescent spill. Some of them are
  deliberately ugly. Nine are night, three dusk, two in brutal midday sun, because the
  daylight frames are what stop the night ones looking like a poster.
  `scripts/shots.json` holds the manifest and `scripts/make-shot-runner.py` builds the
  generator.
- **Cal has a voice, and it ships with the game.** 27 lines — the case file read out, the
  eleven clues, both endings, and the barks. 5 minutes of speech, 3.4 MB, in `public/vo`. **Nothing is synthesised at run time:**
  no key, no network, no speech API. They are just mp3 files.
  `scripts/vo-script.json` is the source of truth for **both** the spoken lines and the
  text on screen — `build-case.py` strips the audio tags for the screen, so the paper on
  the wall and the voice can never disagree. Cal is written plain and blunt on purpose,
  with almost no emotion tags: an earlier draft was stuffed with `[whispers]` and
  `[sighs]` and the delivery came out overacted, which is worse than flat. The takes come
  from ElevenLabs (Eleven v3, "Michael - Gruff and Serious"), and `scripts/process-vo.py`
  masters them — the raw takes
  came back spread across 13 dB, from −14 to −27, which means a whispered clue after a
  loud one is inaudible and the player assumes the sound is broken. `loudnorm` applies one
  gain per file, so quiet moments *inside* a take stay quiet and only the file-to-file
  jumps go. Nothing else is done to them.
- **Nothing plays before you click.** Every line is downstream of a real gesture (the
  START button, a page turn, hitting Save in the editor), which is what browsers require
  and also what stops the game talking at somebody who has not looked at it yet.
- **A preflight for the content.** `scripts/check-case.mjs` walks the case file and
  fails if a photo has no image, a hotspot falls outside the frame or is too small to
  find, an evidence photo has no clue, a noise photo has one, the chain does not match
  the evidence, or a voice line is missing. Unit tests prove the rules; this proves the
  case is actually there. A missing jpg is a broken image in front of a judge and no
  unit test catches it.
- `/lab` is the Phase 1 test bench: a photo, two hotspots, live threshold sliders and a
  pass/fail log. It is how the diff was tuned.

## Run it

```sh
npm install
npm run dev        # http://localhost:3000
npx vitest run                  # the rules
node scripts/check-case.mjs 01  # the content: every photo, hotspot and voice line
npm run build
```

Cal's voice, if the case text changes:

```sh
python scripts/make-vo-lines.py   # writes the script and places the audio tags
# generate the 24 takes in ElevenLabs, save each as <line-id>.mp3 in public/vo
python scripts/process-vo.py      # level-matches them, rebuilds the manifest
```

`process-vo.py` copies the raw takes to `art-raw/vo-el/` before touching anything, so it
can be re-run without paying for the speech twice.

Scripts in `scripts/` show how every asset was made, fetched, compressed and checked.

## Credits

See [CREDITS.md](CREDITS.md) for every model, texture and author.

---

Unofficial fan project. **Not affiliated with or endorsed by Rockstar Games or
Take-Two Interactive.** No Rockstar assets are used anywhere in this repository —
every visual is original or openly licensed. Place names (Leonida, Port Gellhorn,
Grassrivers) are used as names only.
