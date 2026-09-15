"use client";

/**
 * The heart of the game: the box of photos, one photo blown up, and the editor.
 *
 * This is the chain the whole entry rests on —
 *
 *     open the box -> pick a photo -> look at it -> draw on what looks wrong
 *     -> the pixel diff reads where you drew -> a clue unlocks
 *
 * The editor is not a decoration bolted on at the end. It is the only way to
 * make progress, and drawing is how you point at something.
 *
 * It all lives in a flat layer ON TOP of the 3D room rather than inside it,
 * because the Unlayer editor is a DOM component and cannot be painted into a
 * WebGL canvas. That turns out to feel right anyway: it reads as leaning in
 * close to a photo, the way inspecting an item works in a game.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import ImageEditor from "@unlayer/react-image-editor";
import { MAX_HINTS, canPin, nextHint, type Hint } from "@/lib/game";
import { detectHits, type Hotspot } from "@/lib/hit-detect";
import { compressMark, shown, type Marks } from "@/lib/marks";
import { voClue, voMiss, voPin } from "@/lib/vo";
import { Zoomable } from "./zoomable";
import type { CaseFile, CasePhoto } from "@/lib/case";

/**
 * Only the tools that mark the image. Crop and resize change the dimensions and
 * filter changes every pixel — any of the three would make the diff meaningless.
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

export type Verdict =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "hit"; clues: string[] }
  | { kind: "miss" };

export interface EvidenceProps {
  file: CaseFile;
  /** Hotspot ids already unlocked, so a photo can show what it has given up. */
  found: string[];
  /** Photo ids already on the board. */
  pinned: string[];
  /** The player's drawn-on copies, keyed by photo id. */
  marks: Marks;
  /**
   * The photo the game wants looked at next, or null while the player is free.
   *
   * Once enough of the yard is proved, the box quietly starts handing over the
   * chain about Luis one photo at a time. A judge has three minutes; one who
   * reaches the accusation without having walked that chain will name him and
   * leave thinking the game had no story in it.
   */
  next: string | null;
  onFound: (hotspotIds: string[]) => void;
  onPin: (photoId: string) => void;
  /** A photo has been drawn on. The data URL is already compressed. */
  onMark: (photoId: string, dataUrl: string) => void;
  /** Throw away one photo's drawing. */
  onClearMark: (photoId: string) => void;
  /** Hints already spent. Five in a playthrough. */
  hintsUsed: number;
  /** Hotspots a hint has already named. Asking about one of these is free. */
  hintsSeen: string[];
  onUseHint: (hotspotId: string) => void;
  onClose: () => void;
}

type Mode = { screen: "tray" } | { screen: "photo"; photo: CasePhoto } | { screen: "editor"; photo: CasePhoto };

export function Evidence({ file, found, pinned, marks, next, hintsUsed, hintsSeen, onUseHint, onFound, onPin, onMark, onClearMark, onClose }: EvidenceProps) {
  const [mode, setMode] = useState<Mode>({ screen: "tray" });
  const [verdict, setVerdict] = useState<Verdict>({ kind: "idle" });
  // Bumping this remounts the editor: a clean canvas and a freshly armed pen.
  // (editor.reset() leaves the pen disarmed — see PROGRESS.md, Phase 1.)
  const [attempt, setAttempt] = useState(0);

  // Escape always steps back one level rather than dumping you out of the game.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setVerdict({ kind: "idle" });
      setMode((m) => {
        if (m.screen === "editor") return { screen: "photo", photo: m.photo };
        if (m.screen === "photo") return { screen: "tray" };
        onClose();
        return m;
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const onSave = useCallback(
    async ({ dataUrl }: { dataUrl: string }) => {
      if (mode.screen !== "editor") return;
      const photo = mode.photo;
      setVerdict({ kind: "working" });

      // Keep the drawing whether or not it hit anything. It is the player's
      // work and they should get it back — and a wrong circle they can still
      // see is a much better prompt to think again than a blank photo.
      compressMark(dataUrl)
        .then((small) => onMark(photo.id, small))
        .catch(() => {
          /* the mark is a nicety; never let it break the verdict */
        });

      try {
        // Always diff against the ORIGINAL file, never the marked copy, or the
        // second drawing on a photo would be measured against the first.
        const result = await detectHits(photo.src, dataUrl, photo.hotspots as Hotspot[]);
        const fresh = result.hits.filter((id) => !found.includes(id));
        if (result.hits.length) {
          // A photo can offer two ways to point at the same thing (both plates
          // in twin-plates), so the same clue can come back twice. Say it once.
          const clues = [
            ...new Set(
              photo.hotspots.filter((h) => result.hits.includes(h.id)).map((h) => h.clue ?? h.id),
            ),
          ];
          if (fresh.length) onFound(fresh);
          setVerdict({ kind: "hit", clues });
          // Cal reads the clue out. Only the first, even if the circle caught
          // two — he does not queue. An alternate hotspot borrows the voice line
          // of the one it duplicates.
          const firstHit = photo.hotspots.find((h) => h.id === result.hits[0]);
          voClue(firstHit?.voiceAs ?? result.hits[0]);
        } else {
          setVerdict({ kind: "miss" });
          voMiss();
        }
      } catch {
        setVerdict({ kind: "miss" });
        voMiss();
      }
    },
    [mode, found, onFound, onMark],
  );

  return (
    <div className="absolute inset-0 z-20 bg-[var(--night-deep)]/96 backdrop-blur-sm">
      {mode.screen === "tray" && (
        <Tray
          file={file}
          found={found}
          marks={marks}
          next={next}
          hintsUsed={hintsUsed}
          hintsSeen={hintsSeen}
          onUseHint={onUseHint}
          onPick={(photo) => setMode({ screen: "photo", photo })}
          onClose={onClose}
        />
      )}

      {mode.screen === "photo" && (
        <PhotoView
          photo={mode.photo}
          src={shown(marks, mode.photo.id, mode.photo.src)}
          found={found}
          pinned={pinned.includes(mode.photo.id)}
          canPinIt={canPin(file, found, mode.photo.id)}
          onClear={() => onClearMark(mode.photo.id)}
          onPin={() => {
            onPin(mode.photo.id);
            voPin();
          }}
          onMark={() => {
            setVerdict({ kind: "idle" });
            setMode({ screen: "editor", photo: mode.photo });
          }}
          onBack={() => setMode({ screen: "tray" })}
        />
      )}

      {mode.screen === "editor" && (
        <EditorView
          photo={mode.photo}
          marked={!!marks[mode.photo.id]}
          attempt={attempt}
          verdict={verdict}
          pinned={pinned.includes(mode.photo.id)}
          onSave={onSave}
          onRetry={() => {
            setVerdict({ kind: "idle" });
            setAttempt((a) => a + 1);
          }}
          onPin={() => {
            onPin(mode.photo.id);
            voPin();
          }}
          onBack={() => {
            setVerdict({ kind: "idle" });
            setMode({ screen: "photo", photo: mode.photo });
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Tray({
  file,
  found,
  marks,
  next,
  hintsUsed,
  hintsSeen,
  onUseHint,
  onPick,
  onClose,
}: {
  file: CaseFile;
  found: string[];
  marks: Marks;
  next: string | null;
  hintsUsed: number;
  hintsSeen: string[];
  onUseHint: (hotspotId: string) => void;
  onPick: (p: CasePhoto) => void;
  onClose: () => void;
}) {
  const cluesOn = useCallback(
    (p: CasePhoto) => p.hotspots.filter((h) => found.includes(h.id)).length,
    [found],
  );

  /*
   * A hint names a photo and describes the thing to look at in it. It never
   * says where on screen — the player still has to find it and still has to
   * draw on it, which is the part that is actually the game.
   */
  const [hint, setHint] = useState<Hint | null>(null);
  const hintsLeft = MAX_HINTS - hintsUsed;

  /*
   * What the next press would hand over, worked out before the press.
   *
   * The button needs this to know two things it cannot otherwise know: whether
   * there is anything left to point at, and whether it would cost anything. A
   * hint you already paid for is free to read again, so running out of hints
   * must not lock you out of the sentence you already own.
   */
  const pending = useMemo(() => nextHint(file, found), [file, found]);
  const free = pending ? hintsSeen.includes(pending.hotspotId) : false;
  const canAsk = !!pending && (free || hintsLeft > 0);

  const askForHint = useCallback(() => {
    if (!canAsk || !pending) return;
    setHint(pending);
    onUseHint(pending.hotspotId);
  }, [canAsk, pending, onUseHint]);

  /*
   * Whatever the game wants looked at next goes to the front of the pile.
   *
   * Not a quest marker, and nothing is locked — it is just on top, the way it
   * would be if somebody had pulled it out and handed it to you. The ring round
   * it is the only thing that admits the game is steering.
   */
  const order = useMemo(() => {
    if (!next) return file.photos;
    const rest = file.photos.filter((p) => p.id !== next);
    const first = file.photos.find((p) => p.id === next);
    return first ? [first, ...rest] : file.photos;
  }, [file.photos, next]);

  return (
    <div className="flex h-full flex-col p-6 md:p-10">
      <header className="mb-5 flex items-baseline justify-between">
        <div>
          <h2 className="font-mono text-sm tracking-[0.3em] text-[var(--neon-cyan)]">THE BOX</h2>
          <p className="mt-1 text-sm text-[var(--paper)]/55">
            {file.photos.length} photos. Open one and draw on whatever looks wrong.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={askForHint}
            disabled={!canAsk}
            className="rounded border border-[var(--sodium)]/35 px-3 py-1.5 font-mono text-xs tracking-widest text-[var(--sodium)]/90 transition hover:border-[var(--sodium)] hover:bg-[var(--sodium)]/10 disabled:border-[var(--paper)]/15 disabled:text-[var(--paper)]/30 disabled:hover:bg-transparent"
          >
            {free ? "HINT · AGAIN" : hintsLeft > 0 ? `HINT · ${hintsLeft} LEFT` : "NO HINTS LEFT"}
          </button>
          <button
            onClick={onClose}
            className="rounded border border-[var(--paper)]/25 px-3 py-1.5 font-mono text-xs tracking-widest text-[var(--paper)]/70 hover:bg-[var(--paper)]/10"
          >
            ESC
          </button>
        </div>
      </header>

      {/* What Cal would say if you asked him. Sits above the grid so it cannot
        * be missed, and stays until dismissed. */}
      {hint && (
        <div className="mb-4 flex items-start gap-4 rounded border border-[var(--sodium)]/30 bg-[var(--sodium)]/8 px-4 py-3">
          <div className="relative h-14 w-[4.7rem] shrink-0 overflow-hidden rounded-sm border border-[var(--sodium)]/30">
            <Image
              src={shown(marks, hint.photoId, hint.src)}
              alt=""
              fill
              sizes="80px"
              className="object-cover"
              unoptimized={!!marks[hint.photoId]}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] tracking-[0.25em] text-[var(--sodium)]">
              LOOK AT THIS ONE
            </p>
            <p className="mt-1 font-mono text-[11px] text-[var(--paper)]/55">
              &ldquo;{hint.caption}&rdquo;
            </p>
            <p className="mt-1.5 text-sm leading-6 text-[var(--paper)]/85">{hint.hint}</p>
          </div>
          <button
            onClick={() => setHint(null)}
            className="shrink-0 rounded border border-[var(--paper)]/20 px-2.5 py-1 font-mono text-[10px] tracking-widest text-[var(--paper)]/55 hover:bg-[var(--paper)]/10"
          >
            OK
          </button>
        </div>
      )}

      {/*
        * overflow-x-hidden because the tiles are rotated a degree or two and
        * their corners poke past the edge, which was enough to put a horizontal
        * scrollbar under a grid that already wraps.
        */}
      <div className="thin-scroll grid flex-1 auto-rows-min grid-cols-2 gap-3 overflow-y-auto overflow-x-hidden px-1 pb-2 sm:grid-cols-3 lg:grid-cols-5">
        {order.map((p, i) => {
          const n = cluesOn(p);
          const wanted = p.id === next;
          return (
            <button
              key={p.id}
              onClick={() => onPick(p)}
              className={`group relative aspect-[4/3] overflow-hidden rounded-sm border bg-black transition ${
                wanted
                  ? "border-[var(--sodium)] shadow-[0_0_24px_rgba(240,147,47,0.45)]"
                  : "border-[var(--paper)]/12 hover:border-[var(--paper)]/45"
              }`}
              style={{ transform: `rotate(${(((i * 37) % 9) - 4) * 0.22}deg)` }}
            >
              <Image
                src={shown(marks, p.id, p.src)}
                alt={p.caption}
                unoptimized={!!marks[p.id]}
                fill
                sizes="(max-width: 640px) 50vw, 20vw"
                className="object-cover opacity-90 transition group-hover:opacity-100"
              />
              {n > 0 && (
                <span className="absolute right-1.5 top-1.5 rounded-sm bg-[var(--neon-pink)] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#1a0a14] shadow-[0_0_12px_rgba(255,47,158,0.55)]">
                  {n}
                </span>
              )}
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-2 text-left font-mono text-[10px] leading-tight text-[var(--paper)]/80">
                {p.caption}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * The photo, big and clean, BEFORE the pen appears.
 *
 * Deliberately a separate step. If the editor opened straight away people draw
 * before they look, and looking is the entire game.
 */
function PhotoView({
  photo,
  src,
  found,
  pinned,
  canPinIt,
  onPin,
  onMark,
  onClear,
  onBack,
}: {
  photo: CasePhoto;
  /** The marked copy if the player drew on it, otherwise the original. */
  src: string;
  found: string[];
  pinned: boolean;
  /** False while the photo is still hiding something. */
  canPinIt: boolean;
  onPin: () => void;
  onMark: () => void;
  onClear: () => void;
  onBack: () => void;
}) {
  // The photo is only its own file until the player draws on it; after that the
  // shown copy is theirs, and offering "MARK IT" on a photo already covered in
  // red pen reads like the game forgot.
  const marked = src !== photo.src;

  const unlocked = useMemo(
    () => photo.hotspots.filter((h) => found.includes(h.id)),
    [photo, found],
  );

  return (
    <div className="flex h-full flex-col p-6 md:p-10">
      {/* Several of the things you are meant to spot are only a few dozen
        * pixels across at this size. Without a way to lean in, a player decides
        * the photo is empty and moves on. */}
      <Zoomable
        src={src}
        alt={photo.caption}
        priority
        unoptimized={src !== photo.src}
        className="min-h-0 flex-1"
      />

      <p className="mt-4 text-center font-mono text-xs tracking-widest text-[var(--paper)]/50">
        {photo.caption}
      </p>

      {unlocked.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {unlocked.map((h) => (
            <p key={h.id} className="text-center text-sm text-[var(--neon-cyan)]/90">
              &ldquo;{h.clue}&rdquo;
            </p>
          ))}
        </div>
      )}

      <div className="mt-5 flex items-center justify-center gap-3">
        <button
          onClick={onBack}
          className="rounded border border-[var(--paper)]/25 px-4 py-2 font-mono text-xs tracking-widest text-[var(--paper)]/70 hover:bg-[var(--paper)]/10"
        >
          BACK TO THE BOX
        </button>
        <button
          onClick={onMark}
          className="rounded bg-[var(--neon-pink)] px-5 py-2 font-mono text-xs font-bold tracking-widest text-[#1a0a14] shadow-[0_0_18px_rgba(255,47,158,0.4)] transition hover:brightness-110"
        >
          {marked ? "MARK IT AGAIN" : "MARK IT"}
        </button>

        {/*
          * The only way back to a clean photo. There is no cross-session undo to
          * offer instead — the editor cannot restore a saved drawing — so the
          * player gets an explicit way to bin one.
          */}
        {marked && (
          <button
            onClick={onClear}
            className="rounded border border-[var(--paper)]/20 px-4 py-2 font-mono text-xs tracking-widest text-[var(--paper)]/55 transition hover:border-[var(--sodium)]/60 hover:text-[var(--sodium)]"
          >
            CLEAR MY MARKS
          </button>
        )}
        <button
          onClick={onPin}
          disabled={pinned || !canPinIt}
          title={canPinIt ? undefined : "Cal will not put a photo up until you have shown him what is wrong with it"}
          className="rounded border border-[var(--paper)]/25 px-4 py-2 font-mono text-xs tracking-widest text-[var(--paper)]/70 hover:bg-[var(--paper)]/10 disabled:opacity-40 disabled:hover:bg-transparent"
        >
          {pinned ? "ON THE BOARD" : canPinIt ? "PIN TO BOARD" : "MARK IT FIRST"}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function EditorView({
  photo,
  marked,
  attempt,
  verdict,
  pinned,
  onSave,
  onRetry,
  onPin,
  onBack,
}: {
  photo: CasePhoto;
  /** Whether a drawing is already saved for this photo, which this one replaces. */
  marked: boolean;
  attempt: number;
  verdict: Verdict;
  pinned: boolean;
  onSave: (r: { dataUrl: string }) => void;
  onRetry: () => void;
  onPin: () => void;
  onBack: () => void;
}) {
  const btn = "rounded border border-[var(--paper)]/25 px-4 py-2 font-mono text-xs tracking-widest text-[var(--paper)]/80 hover:bg-[var(--paper)]/10";
  return (
    <div className="flex h-full flex-col p-4 md:p-6">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-mono text-xs tracking-widest text-[var(--neon-cyan)]/75">
          DRAW ON WHAT LOOKS WRONG, THEN SAVE
          {marked && (
            <span className="ml-3 text-[var(--sodium)]/80">· THIS REPLACES YOUR LAST MARKS</span>
          )}
        </p>
        <button
          onClick={onBack}
          className="rounded border border-[var(--paper)]/25 px-3 py-1.5 font-mono text-xs tracking-widest text-[var(--paper)]/70 hover:bg-[var(--paper)]/10"
        >
          BACK
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded [&>div]:h-full">
        <ImageEditor
          // Always the clean plate, never the player's saved copy. Undo cannot
          // reach pixels that were baked into the image it opened with.
          key={attempt}
          image={photo.src}
          options={EDITOR_OPTIONS}
          minHeight="100%"
          style={{ height: "100%", width: "100%" }}
          onSave={onSave}
          onCancel={onBack}
        />
      </div>

      <div className="mt-3 min-h-[4.5rem]">
        {verdict.kind === "working" && (
          <p className="text-center font-mono text-xs tracking-widest text-[var(--paper)]/50">READING THE MARKS…</p>
        )}
        {verdict.kind === "miss" && (
          <div className="flex flex-col items-center gap-3">
            <p className="font-mono text-sm tracking-[0.3em] text-[var(--sodium)]">NOTHING THERE</p>
            <p className="text-sm text-[var(--paper)]/60">That is just looking. It costs you nothing.</p>
            <div className="flex gap-3">
              <button onClick={onRetry} className={btn}>WIPE IT AND DRAW AGAIN</button>
              <button onClick={onBack} className={btn}>BACK TO THE PHOTO</button>
            </div>
          </div>
        )}
        {verdict.kind === "hit" && (
          <div className="flex flex-col items-center gap-3">
            {verdict.clues.map((c) => (
              <p key={c} className="text-center text-lg text-[var(--neon-cyan)]">&ldquo;{c}&rdquo;</p>
            ))}
            <div className="flex gap-3">
              <button onClick={onPin} disabled={pinned} className="rounded bg-[var(--neon-pink)] px-5 py-2 font-mono text-xs font-bold tracking-widest text-[#1a0a14] shadow-[0_0_18px_rgba(255,47,158,0.4)] transition hover:brightness-110 disabled:opacity-35 disabled:shadow-none">
                {pinned ? "ON THE BOARD" : "PIN TO BOARD"}
              </button>
              <button onClick={onBack} className={btn}>BACK TO THE PHOTO</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
