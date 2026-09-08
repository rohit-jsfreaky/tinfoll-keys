/**
 * Hit detection — the mechanic the whole game rests on.
 *
 * The Unlayer editor hands back a flattened image and nothing else. No layers,
 * no "the user drew a circle at x,y". So we work it out backwards: rasterise the
 * original and the saved image onto the same grid, find the pixels that changed,
 * group them into marks, and test those marks against the hotspots for the photo.
 *
 * Everything here is browser-only (it uses <canvas>). Import it from a client
 * component.
 */

/** [x, y, w, h] as fractions of the image, so it survives any display size. */
export type Rect = readonly [number, number, number, number];

export interface Hotspot {
  id: string;
  rect: Rect;
  clue?: string;
}

export interface DetectOptions {
  /** Longest side of the working grid. Small = fast and forgiving of grain. */
  workSize: number;
  /** Per-pixel change threshold (0-255) applied to the blurred diff map. */
  threshold: number;
  /** Marks smaller than this fraction of the image are treated as noise. */
  minMarkArea: number;
  /** Hotspots grow by this fraction of the image before testing. Generosity. */
  pad: number;
  /** Separate marks closer than this (fraction of the long side) are merged. */
  mergeGap: number;
  /** A single mark bigger than this is a scribble-over-everything, not a point. */
  maxMarkArea: number;
  /** More changed pixels than this means the whole image moved, not an edit. */
  maxTotalChanged: number;
}

export const DEFAULTS: DetectOptions = {
  workSize: 512,
  threshold: 26,
  minMarkArea: 0.0004,
  pad: 0.06,
  mergeGap: 0.03,
  maxMarkArea: 0.55,
  maxTotalChanged: 0.6,
};

/** One thing the user drew, reduced to a box. */
export interface Mark {
  bbox: Rect;
  center: readonly [number, number];
  pixels: number;
  /** Bounding-box area as a fraction of the image. */
  area: number;
}

export type DetectFailure = "aspect-changed" | "whole-image-changed";

export interface DetectResult {
  /** False when the edit was not a mark we can read (crop, resize, filter). */
  ok: boolean;
  reason?: DetectFailure;
  /** Hotspot ids the user drew on. */
  hits: string[];
  marks: Mark[];
  /** Fraction of pixels over the threshold. */
  changed: number;
  stats: { max: number; mean: number; p99: number };
  work: { w: number; h: number };
  /** True pixel sizes of both images. The editor should hand back what it got. */
  size: { origW: number; origH: number; savedW: number; savedH: number };
  /** Diff mask at working resolution, for the debug overlay. */
  mask: Uint8Array;
}

/* ------------------------------------------------------------------ */
/* raster helpers                                                      */
/* ------------------------------------------------------------------ */

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Data URLs are already same-origin; asking for CORS on them is pointless
    // and some browsers are fussy about it.
    if (!src.startsWith("data:")) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("could not load image: " + src.slice(0, 64)));
    img.src = src;
  });
}

function rasterise(img: HTMLImageElement, w: number, h: number): Uint8ClampedArray {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("no 2d context");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  // Stretch onto the working grid. Both images go through the identical path,
  // so any resampling error applies to both and cancels out in the diff.
  ctx.drawImage(img, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h).data;
}

/** Fit the image inside a workSize box, keeping its aspect. */
function workGrid(img: HTMLImageElement, workSize: number) {
  const scale = workSize / Math.max(img.naturalWidth, img.naturalHeight);
  return {
    w: Math.max(1, Math.round(img.naturalWidth * scale)),
    h: Math.max(1, Math.round(img.naturalHeight * scale)),
  };
}

/* ------------------------------------------------------------------ */
/* the diff                                                            */
/* ------------------------------------------------------------------ */

/** Per-pixel change, as the largest single-channel shift. */
function diffMap(a: Uint8ClampedArray, b: Uint8ClampedArray, n: number): Uint8Array {
  const out = new Uint8Array(n);
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const dr = Math.abs(a[p] - b[p]);
    const dg = Math.abs(a[p + 1] - b[p + 1]);
    const db = Math.abs(a[p + 2] - b[p + 2]);
    out[i] = dr > dg ? (dr > db ? dr : db) : dg > db ? dg : db;
  }
  return out;
}

/**
 * 3x3 box blur, separable. JPEG grain and resampling wobble show up as single
 * loud pixels; a real pen stroke is a run of them. Blurring first keeps the
 * stroke and flattens the noise, which is what lets one threshold work on a
 * grainy night photo.
 */
function blur3(src: Uint8Array, w: number, h: number): Uint8Array {
  const tmp = new Uint8Array(src.length);
  const out = new Uint8Array(src.length);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const l = src[row + (x > 0 ? x - 1 : 0)];
      const c = src[row + x];
      const r = src[row + (x < w - 1 ? x + 1 : w - 1)];
      tmp[row + x] = (l + c + r) / 3;
    }
  }
  for (let y = 0; y < h; y++) {
    const up = (y > 0 ? y - 1 : 0) * w;
    const mid = y * w;
    const dn = (y < h - 1 ? y + 1 : h - 1) * w;
    for (let x = 0; x < w; x++) {
      out[mid + x] = (tmp[up + x] + tmp[mid + x] + tmp[dn + x]) / 3;
    }
  }
  return out;
}

/** Grow the mask by one pixel so a dashed or scratchy stroke joins up. */
function dilate(mask: Uint8Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let on = 0;
      for (let dy = -1; dy <= 1 && !on; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          if (mask[yy * w + xx]) {
            on = 1;
            break;
          }
        }
      }
      out[y * w + x] = on;
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* marks                                                               */
/* ------------------------------------------------------------------ */

interface Blob {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  pixels: number;
}

/** Flood fill the mask into blobs, 8-connected, iteratively (no recursion). */
function findBlobs(mask: Uint8Array, w: number, h: number): Blob[] {
  const seen = new Uint8Array(mask.length);
  const stack: number[] = [];
  const blobs: Blob[] = [];

  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue;
    seen[start] = 1;
    stack.push(start);
    const blob: Blob = { minX: w, minY: h, maxX: -1, maxY: -1, pixels: 0 };

    while (stack.length) {
      const i = stack.pop() as number;
      const x = i % w;
      const y = (i / w) | 0;
      blob.pixels++;
      if (x < blob.minX) blob.minX = x;
      if (x > blob.maxX) blob.maxX = x;
      if (y < blob.minY) blob.minY = y;
      if (y > blob.maxY) blob.maxY = y;

      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          const j = yy * w + xx;
          if (mask[j] && !seen[j]) {
            seen[j] = 1;
            stack.push(j);
          }
        }
      }
    }
    blobs.push(blob);
  }
  return blobs;
}

/** Gap between two boxes, in pixels. Zero when they touch or overlap. */
function boxGap(a: Blob, b: Blob): number {
  const dx = Math.max(0, Math.max(a.minX - b.maxX, b.minX - a.maxX));
  const dy = Math.max(0, Math.max(a.minY - b.maxY, b.minY - a.maxY));
  return Math.max(dx, dy);
}

/**
 * Join blobs that are basically one gesture. A circle drawn in two strokes, or
 * a circle with an arrow, should read as a single accusation, not three.
 */
function mergeBlobs(blobs: Blob[], gap: number): Blob[] {
  const out = blobs.slice();
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        if (boxGap(out[i], out[j]) > gap) continue;
        out[i] = {
          minX: Math.min(out[i].minX, out[j].minX),
          minY: Math.min(out[i].minY, out[j].minY),
          maxX: Math.max(out[i].maxX, out[j].maxX),
          maxY: Math.max(out[i].maxY, out[j].maxY),
          pixels: out[i].pixels + out[j].pixels,
        };
        out.splice(j, 1);
        merged = true;
        break outer;
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* hit testing                                                         */
/* ------------------------------------------------------------------ */

function grow(rect: Rect, pad: number): Rect {
  return [rect[0] - pad, rect[1] - pad, rect[2] + pad * 2, rect[3] + pad * 2];
}

function contains(rect: Rect, px: number, py: number): boolean {
  return px >= rect[0] && px <= rect[0] + rect[2] && py >= rect[1] && py <= rect[1] + rect[3];
}

function overlapArea(a: Rect, b: Rect): number {
  const x = Math.max(0, Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0]));
  const y = Math.max(0, Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]));
  return x * y;
}

/**
 * Did this mark point at this hotspot? Three ways to say yes, because people
 * point in three ways: they scribble on it, they draw a ring around it, or they
 * leave a rough blob across it.
 */
function marksHotspot(mark: Mark, spot: Hotspot, pad: number): boolean {
  const padded = grow(spot.rect, pad);

  // 1. The middle of the mark lands on the thing.
  if (contains(padded, mark.center[0], mark.center[1])) return true;

  const spotArea = spot.rect[2] * spot.rect[3];
  const over = overlapArea(mark.bbox, spot.rect);

  // 2. The mark is a ring drawn around the thing.
  if (spotArea > 0 && over / spotArea >= 0.6) return true;

  // 3. The mark and the thing substantially share space.
  const markArea = mark.area || 1e-6;
  if (over / Math.min(markArea, spotArea || markArea) >= 0.35) return true;

  return false;
}

/* ------------------------------------------------------------------ */
/* the entry point                                                     */
/* ------------------------------------------------------------------ */

export async function detectHits(
  originalSrc: string,
  savedSrc: string,
  hotspots: Hotspot[],
  options: Partial<DetectOptions> = {},
): Promise<DetectResult> {
  const opt = { ...DEFAULTS, ...options };
  const [original, saved] = await Promise.all([loadImage(originalSrc), loadImage(savedSrc)]);

  const { w, h } = workGrid(original, opt.workSize);
  const n = w * h;
  const size = {
    origW: original.naturalWidth,
    origH: original.naturalHeight,
    savedW: saved.naturalWidth,
    savedH: saved.naturalHeight,
  };
  const fail = (reason: DetectFailure): DetectResult => ({
    ok: false,
    reason,
    hits: [],
    marks: [],
    changed: 1,
    stats: { max: 255, mean: 255, p99: 255 },
    work: { w, h },
    size,
    mask: new Uint8Array(n),
  });

  // Crop and resize are switched off in the editor, but never trust the tool rail.
  const aspectA = original.naturalWidth / original.naturalHeight;
  const aspectB = saved.naturalWidth / saved.naturalHeight;
  if (Math.abs(aspectA - aspectB) / aspectA > 0.02) return fail("aspect-changed");

  const before = rasterise(original, w, h);
  const after = rasterise(saved, w, h);

  const raw = diffMap(before, after, n);
  const smooth = blur3(raw, w, h);

  // Stats come off the smoothed map, because that is what the threshold sees.
  const histogram = new Uint32Array(256);
  let sum = 0;
  let max = 0;
  for (let i = 0; i < n; i++) {
    const v = smooth[i];
    histogram[v]++;
    sum += v;
    if (v > max) max = v;
  }
  let acc = 0;
  let p99 = 0;
  const cut = n * 0.99;
  for (let v = 0; v < 256; v++) {
    acc += histogram[v];
    if (acc >= cut) {
      p99 = v;
      break;
    }
  }

  let mask: Uint8Array = new Uint8Array(n);
  let changedPixels = 0;
  for (let i = 0; i < n; i++) {
    if (smooth[i] > opt.threshold) {
      mask[i] = 1;
      changedPixels++;
    }
  }
  const changed = changedPixels / n;
  const stats = { max, mean: sum / n, p99 };

  // A filter, a resize, or a re-encode that moved everything. Not a mark.
  if (changed > opt.maxTotalChanged) {
    return { ...fail("whole-image-changed"), changed, stats, mask };
  }

  mask = dilate(mask, w, h);

  const long = Math.max(w, h);
  const blobs = mergeBlobs(findBlobs(mask, w, h), Math.round(opt.mergeGap * long));

  const marks: Mark[] = [];
  for (const b of blobs) {
    if (b.pixels / n < opt.minMarkArea) continue;
    const bx = b.minX / w;
    const by = b.minY / h;
    const bw = (b.maxX - b.minX + 1) / w;
    const bh = (b.maxY - b.minY + 1) / h;
    marks.push({
      bbox: [bx, by, bw, bh],
      center: [bx + bw / 2, by + bh / 2],
      pixels: b.pixels,
      area: bw * bh,
    });
  }
  marks.sort((a, b) => b.pixels - a.pixels);

  const hits: string[] = [];
  for (const mark of marks) {
    if (mark.area > opt.maxMarkArea) continue; // scribbled over the whole photo
    for (const spot of hotspots) {
      if (hits.includes(spot.id)) continue;
      if (marksHotspot(mark, spot, opt.pad)) hits.push(spot.id);
    }
  }

  return { ok: true, hits, marks, changed, stats, work: { w, h }, size, mask };
}
