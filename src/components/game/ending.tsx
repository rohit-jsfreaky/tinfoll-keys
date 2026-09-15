"use client";

/**
 * The two endings.
 *
 * WASTED is what GTA actually does: a still frame, the colour drains out, big
 * text, and a slow push in on the moment it went wrong. Here the moment is the
 * photo that cost the last star. CASE CRACKED is the mirror of it, warm instead
 * of grey.
 *
 * Both say what happened because of your call. That text is written in
 * case.json and it is the cheapest thing in the whole game and the thing people
 * will remember.
 */

import { useEffect, useState } from "react";
import Image from "next/image";
import type { CaseFile } from "@/lib/case";
import type { GameState } from "@/lib/game";
import { stop, voEnding } from "@/lib/vo";

export function Ending({
  file,
  game,
  onRestart,
}: {
  file: CaseFile;
  game: GameState;
  onRestart: () => void;
}) {
  const wasted = game.phase === "wasted";
  const [pushed, setPushed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setPushed(true), 60);
    return () => clearTimeout(t);
  }, []);

  // A beat after the title lands, so WASTED gets its silence first.
  useEffect(() => {
    const t = setTimeout(() => voEnding(wasted), 1400);
    return () => {
      clearTimeout(t);
      stop();
    };
  }, [wasted]);

  /*
   * WASTED pushes in on Luis.
   *
   * Not on an arrest and not on anything melodramatic — three minutes has not
   * earned that. Just the photograph of the man whose name you put on it, which
   * is the one you were looking at when you decided.
   */
  const wrong = wasted
    ? file.photos.find((p) => p.hotspots.some((h) => h.id === file.required[0]))
    : null;
  const text = wasted ? file.endings.lost : file.endings.win;

  return (
    <div className={`absolute inset-0 z-30 flex flex-col ${wasted ? "bg-black/70" : "bg-[var(--night-deep)]/80"}`}>
      {/* the photo you got wrong, pushed in on slowly */}
      {wrong && (
        <div className="absolute inset-0 overflow-hidden">
          <Image
            src={wrong.src}
            alt={wrong.caption}
            fill
            sizes="100vw"
            priority
            className={`object-cover grayscale transition-transform duration-[9000ms] ease-out ${
              pushed ? "scale-[1.16]" : "scale-100"
            }`}
            style={{ opacity: 0.55 }}
          />
        </div>
      )}

      <div className="relative flex flex-1 flex-col items-center justify-center px-6 text-center">
        <h1
          className={`font-mono font-black uppercase leading-none tracking-[0.18em] transition-all duration-700 ${
            pushed ? "opacity-100" : "translate-y-3 opacity-0"
          } ${wasted ? "text-[var(--wanted)]" : "text-[var(--neon-pink)]"}`}
          style={{
            fontSize: "clamp(3rem, 12vw, 9rem)",
            textShadow: wasted ? "0 0 48px rgba(229,52,42,0.65)" : "0 0 48px rgba(255,47,158,0.6)",
          }}
        >
          {wasted ? "WASTED" : "CASE CRACKED"}
        </h1>

        {/* The whole game in seven words. */}
        {wasted && (
          <p
            className={`mt-5 font-mono text-xs leading-6 tracking-[0.3em] text-[var(--paper)]/70 transition-opacity delay-700 duration-1000 ${
              pushed ? "opacity-100" : "opacity-0"
            }`}
          >
            YOU HAD THE YARD RIGHT.
            <br />
            YOU HAD THE MAN WRONG.
          </p>
        )}

        <div
          className={`mt-10 max-w-xl space-y-4 font-serif text-lg leading-8 text-[var(--paper)] transition-opacity delay-1000 duration-1000 ${
            pushed ? "opacity-100" : "opacity-0"
          }`}
        >
          {text.split("\n\n").map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>

        <button
          onClick={onRestart}
          className={`mt-12 rounded border border-[var(--paper)]/40 px-6 py-2.5 font-mono text-xs tracking-[0.3em] text-[var(--paper)] transition-opacity delay-[2200ms] duration-700 hover:bg-[var(--paper)]/10 ${
            pushed ? "opacity-100" : "opacity-0"
          }`}
        >
          {wasted ? "TRY AGAIN" : "PLAY AGAIN"}
        </button>
      </div>
    </div>
  );
}
