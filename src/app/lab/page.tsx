"use client";

/**
 * Phase 1 lab — the throwaway page that proves hit detection.
 *
 * Draw on the photo, hit save, and this page tells you which hotspot you
 * pointed at. Nothing here ships in the game; it exists to settle the one
 * question the whole design rests on, and to tune the thresholds against real
 * saves instead of guesses.
 */

import { useCallback, useMemo, useRef, useState } from "react";
import ImageEditor, {
  type ImageEditorInstance,
  type ImageEditorRef,
} from "@unlayer/react-image-editor";
import {
  DEFAULTS,
  detectHits,
  loadImage,
  type DetectResult,
  type Hotspot,
} from "@/lib/hit-detect";

/**
 * Now pointed at the real Case 1 art, not the stand-in. Grain and JPEG noise on
 * a real photo are heavier than on a generated test image, so the threshold has
 * to hold up here — that was the last open question from Phase 1.
 */
const IMAGE = "/cases/01/boat-night.jpg";

/** The real rects from public/cases/01/case.json. */
const HOTSPOTS: Hotspot[] = [
  {
    id: "rod-holders",
    rect: [0.34, 0.45, 0.53, 0.15],
    clue: "Six rod holders. All empty. Nobody fishes with no rods.",
  },
  {
    id: "waterline",
    rect: [0.28, 0.72, 0.58, 0.13],
    clue: "She is sitting low. That boat is carrying something heavy.",
  },
];

/**
 * Only the tools that mark the image. Crop and resize change the dimensions and
 * filter changes every pixel — all three would make the diff meaningless.
 * `features` is remount-tier, so this object is defined once, outside render.
 */
const EDITOR_OPTIONS = {
  theme: "dark" as const,
  features: {
    imageEditor: {
      tools: {
        crop: false,
        resize: false,
        filter: false,
        frame: false,
        draw: true,
        text: true,
        shapes: true,
        stickers: true,
      },
    },
  },
};

type Aim = "rod-holders" | "waterline" | "nothing";

interface Run {
  n: number;
  aim: Aim;
  hits: string[];
  pass: boolean;
  changed: number;
  p99: number;
  max: number;
  marks: number;
  ms: number;
  note?: string;
}

const OVERLAY_W = 520;

export default function LabPage() {
  const editorRef = useRef<ImageEditorRef>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [threshold, setThreshold] = useState(DEFAULTS.threshold);
  const [pad, setPad] = useState(DEFAULTS.pad);
  const [aim, setAim] = useState<Aim>("rod-holders");
  const [runs, setRuns] = useState<Run[]>([]);
  const [last, setLast] = useState<DetectResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passRate = useMemo(() => {
    if (!runs.length) return null;
    return runs.filter((r) => r.pass).length + "/" + runs.length;
  }, [runs]);

  /** Paint the original, the hotspots, the diff mask and the detected marks. */
  const paint = useCallback(async (result: DetectResult | null) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const img = await loadImage(IMAGE);
    const scale = OVERLAY_W / img.naturalWidth;
    const w = OVERLAY_W;
    const h = Math.round(img.naturalHeight * scale);
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, w, h);

    // The changed pixels, in green, so the mark is visible against the red boxes.
    if (result) {
      const { w: mw, h: mh } = result.work;
      const layer = ctx.createImageData(mw, mh);
      for (let i = 0; i < result.mask.length; i++) {
        if (!result.mask[i]) continue;
        const p = i * 4;
        layer.data[p] = 60;
        layer.data[p + 1] = 255;
        layer.data[p + 2] = 120;
        layer.data[p + 3] = 150;
      }
      const tmp = document.createElement("canvas");
      tmp.width = mw;
      tmp.height = mh;
      tmp.getContext("2d")?.putImageData(layer, 0, 0);
      ctx.drawImage(tmp, 0, 0, w, h);
    }

    // Hotspots. Solid when hit, dashed when not.
    ctx.lineWidth = 2;
    ctx.font = "12px monospace";
    for (const spot of HOTSPOTS) {
      const hit = result?.hits.includes(spot.id);
      ctx.strokeStyle = hit ? "#38d16a" : "#a3231d";
      ctx.setLineDash(hit ? [] : [6, 4]);
      ctx.strokeRect(spot.rect[0] * w, spot.rect[1] * h, spot.rect[2] * w, spot.rect[3] * h);
      ctx.fillStyle = hit ? "#38d16a" : "#a3231d";
      ctx.fillText(spot.id, spot.rect[0] * w + 3, spot.rect[1] * h - 4);
    }

    // What the detector thinks the user drew.
    if (result) {
      ctx.setLineDash([]);
      ctx.strokeStyle = "#ffd479";
      ctx.lineWidth = 1.5;
      for (const mark of result.marks) {
        ctx.strokeRect(mark.bbox[0] * w, mark.bbox[1] * h, mark.bbox[2] * w, mark.bbox[3] * h);
        ctx.fillStyle = "#ffd479";
        ctx.fillRect(mark.center[0] * w - 3, mark.center[1] * h - 3, 6, 6);
      }
    }
  }, []);

  const run = useCallback(
    async (savedSrc: string, note?: string) => {
      setBusy(true);
      setError(null);
      try {
        const t0 = performance.now();
        const result = await detectHits(IMAGE, savedSrc, HOTSPOTS, { threshold, pad });
        const ms = performance.now() - t0;

        const expected = aim === "nothing" ? [] : [aim];
        const pass =
          result.ok &&
          expected.every((id) => result.hits.includes(id)) &&
          result.hits.length === expected.length;

        // The finish line is a console line, so print one.
        if (result.hits.length) {
          console.info("HIT: " + result.hits.join(", "));
        } else {
          console.info("no hit" + (result.ok ? "" : " (" + result.reason + ")"));
        }

        setLast(result);
        void paint(result);
        setRuns((prev) => [
          ...prev,
          {
            n: prev.length + 1,
            aim,
            hits: result.hits,
            pass,
            changed: result.changed,
            p99: result.stats.p99,
            max: result.stats.max,
            marks: result.marks.length,
            ms,
            note: note ?? result.reason,
          },
        ]);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [aim, pad, paint, threshold],
  );

  const onSave = useCallback(
    ({ dataUrl }: { dataUrl: string }) => {
      void run(dataUrl);
    },
    [run],
  );

  /**
   * Calibration: save with nothing drawn. Whatever the diff reports here is the
   * noise floor of the editor's own re-encode, and the threshold has to sit
   * above it. Measured, not guessed.
   */
  const calibrate = useCallback(() => {
    const editor: ImageEditorInstance | null = editorRef.current?.editor ?? null;
    const dataUrl = editor?.getImage();
    if (!dataUrl) {
      setError("editor not ready");
      return;
    }
    void run(dataUrl, "no-edit calibration");
  }, [run]);

  const reset = useCallback(() => {
    void editorRef.current?.editor?.reset(IMAGE);
  }, []);

  return (
    <main className="min-h-screen bg-[#0d0b09] p-6 text-[#efe7d8]">
      <header className="mb-4">
        <h1 className="font-mono text-lg tracking-widest text-[#a3231d]">
          TINFOIL KEYS — PHASE 1 LAB
        </h1>
        <p className="text-sm opacity-70">
          Draw on the photo and save. This page reports which hotspot you pointed at.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_560px]">
        <section className="min-w-0">
          <ImageEditor
            ref={editorRef}
            image={IMAGE}
            options={EDITOR_OPTIONS}
            minHeight={620}
            onSave={onSave}
            onLoad={() => void paint(null)}
            onLoadError={() => setError("editor could not load the image (CORS or 404)")}
            onError={(e) => setError("editor error: " + e.message)}
          />
        </section>

        <section className="space-y-4">
          <div className="rounded border border-white/10 bg-black/30 p-3">
            <canvas ref={canvasRef} className="w-full" />
            <p className="mt-2 font-mono text-[11px] leading-5 opacity-60">
              red dashed = hotspot · green = hit · green fill = changed pixels · yellow = detected
              mark
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 rounded border border-white/10 bg-black/30 p-3 text-sm">
            <label className="col-span-2 flex flex-col gap-1">
              <span className="font-mono text-xs opacity-70">
                threshold {threshold} — pixel change needed to count
              </span>
              <input
                type="range"
                min={2}
                max={90}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
              />
            </label>
            <label className="col-span-2 flex flex-col gap-1">
              <span className="font-mono text-xs opacity-70">
                pad {pad.toFixed(2)} — how generous the hotspot is
              </span>
              <input
                type="range"
                min={0}
                max={0.2}
                step={0.01}
                value={pad}
                onChange={(e) => setPad(Number(e.target.value))}
              />
            </label>

            <label className="col-span-2 flex items-center gap-2">
              <span className="font-mono text-xs opacity-70">aiming at</span>
              <select
                className="flex-1 rounded bg-black/50 p-1 font-mono text-xs"
                value={aim}
                onChange={(e) => setAim(e.target.value as Aim)}
              >
                <option value="rod-holders">rod-holders</option>
                <option value="waterline">waterline</option>
                <option value="nothing">nothing (sky)</option>
              </select>
            </label>

            <button
              onClick={calibrate}
              disabled={busy}
              className="rounded border border-white/20 px-3 py-2 font-mono text-xs hover:bg-white/10 disabled:opacity-40"
            >
              no-edit calibration
            </button>
            <button
              onClick={reset}
              className="rounded border border-white/20 px-3 py-2 font-mono text-xs hover:bg-white/10"
            >
              reset editor
            </button>
            <button
              onClick={() => {
                setRuns([]);
                setLast(null);
                void paint(null);
              }}
              className="col-span-2 rounded border border-white/20 px-3 py-2 font-mono text-xs hover:bg-white/10"
            >
              clear runs
            </button>
          </div>

          {error && (
            <p className="rounded border border-[#a3231d] bg-[#a3231d]/10 p-3 font-mono text-xs">
              {error}
            </p>
          )}

          {last && (
            <div className="rounded border border-white/10 bg-black/30 p-3 font-mono text-xs leading-6">
              <div className="text-base text-[#38d16a]">
                {last.hits.length ? "HIT: " + last.hits.join(", ") : "no hit"}
                {!last.ok && <span className="text-[#a3231d]"> ({last.reason})</span>}
              </div>
              <div className="opacity-70">
                changed {(last.changed * 100).toFixed(2)}% · marks {last.marks.length} · p99{" "}
                {last.stats.p99} · max {last.stats.max} · mean {last.stats.mean.toFixed(1)} · grid{" "}
                {last.work.w}x{last.work.h}
              </div>
              <div
                className={
                  last.size.origW === last.size.savedW && last.size.origH === last.size.savedH
                    ? "opacity-70"
                    : "text-[#a3231d]"
                }
              >
                in {last.size.origW}x{last.size.origH} · out {last.size.savedW}x{last.size.savedH}
              </div>
            </div>
          )}

          <div className="rounded border border-white/10 bg-black/30 p-3">
            <div className="mb-2 flex items-baseline justify-between font-mono text-xs">
              <span className="opacity-70">runs</span>
              <span className={passRate ? "text-[#38d16a]" : "opacity-40"}>
                {passRate ?? "none yet"}
              </span>
            </div>
            <ol className="space-y-1 font-mono text-[11px]">
              {runs.map((r) => (
                <li key={r.n} className="flex gap-2">
                  <span className="w-6 opacity-50">{r.n}</span>
                  <span className={r.pass ? "text-[#38d16a]" : "text-[#a3231d]"}>
                    {r.pass ? "PASS" : "FAIL"}
                  </span>
                  <span className="opacity-70">aim {r.aim}</span>
                  <span className="flex-1 truncate opacity-90">
                    got [{r.hits.join(",") || "-"}] {r.note ? "· " + r.note : ""}
                  </span>
                  <span className="opacity-50">
                    {(r.changed * 100).toFixed(2)}% p99 {r.p99} {r.ms.toFixed(0)}ms
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </div>
    </main>
  );
}
