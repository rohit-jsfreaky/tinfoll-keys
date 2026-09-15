"use client";

/**
 * How to play.
 *
 * Shown once, the first time somebody loads the game, and reopenable from the
 * corner afterwards. A judge has ninety seconds and no patience for figuring
 * out that the corkboard is a controller — so the one rule that matters is in
 * bold at the top and everything else is five short lines.
 *
 * Neon on deep purple, not blood red on brown. The first draft of this card
 * looked like a horror game; the case photos are magenta and cyan and the card
 * that introduces them should be too.
 */

import { useEffect, useState } from "react";
import { voIntro, warm } from "@/lib/vo";

const SEEN_KEY = "tinfoil-keys:seen-how-to-play";

export function useHowToPlay() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(SEEN_KEY)) setOpen(true);
    } catch {
      setOpen(true); // private mode: show it, just do not remember
    }
  }, []);

  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* nothing to do */
    }
  };

  return { open, show: () => setOpen(true), close };
}

const STEPS = [
  {
    n: "1",
    head: "LOOK AROUND",
    body: "Click once to take hold of the mouse, then move it. Escape gives it back.",
  },
  {
    n: "2",
    head: "READ THE CASE",
    body: "The paper on the wall, left of the board. Cal tells you what he thinks is going on — but not what to look for.",
  },
  {
    n: "3",
    head: "OPEN THE BOX",
    body: "Fourteen photos on the console. There is no junk pile. Every one of them has something in it, even if it is only who somebody is.",
  },
  {
    n: "4",
    head: "DRAW ON WHAT'S WRONG",
    body: "Open a photo, hit MARK IT, and circle the thing that looks off. Right thing, Cal tells you what it is. Wrong thing, nothing happens — looking is free.",
  },
  {
    n: "5",
    head: "PIN IT, TIE STRING",
    body: "Pin what matters and join it up however you think. The board is yours and nothing you tie is marked right or wrong.",
  },
  {
    n: "6",
    head: "NAME THEM",
    body: "When you are ready, say it in one sentence with names in it. That is the only part that is judged.",
  },
];

export function HowToPlay({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    /*
     * The scroll lives on the backdrop, not the card, with `min-h-full` on the
     * inner wrapper. That is what keeps the padding honest: a card taller than
     * the window scrolls WITH its top and bottom margin instead of being clipped
     * flush against both edges, which is what it was doing before.
     */
    <div
      className="thin-scroll absolute inset-0 z-30 overflow-y-auto bg-[var(--night-deep)]/94 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="flex min-h-full items-center justify-center p-6 md:p-10">
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg rounded-lg border border-[var(--electric)]/22 bg-[var(--night)] p-8 shadow-[0_0_70px_rgba(59,155,255,0.14),0_0_120px_rgba(255,47,158,0.1),0_30px_80px_rgba(0,0,0,0.85)]"
        >
          <p className="font-mono text-[10px] tracking-[0.45em] text-[var(--neon-cyan)]">
            HOW TO PLAY
          </p>
          <h2 className="mt-3 text-xl leading-7 text-[var(--paper)]">
            You solve the case by{" "}
            <strong className="font-bold text-[var(--neon-pink)] drop-shadow-[0_0_14px_rgba(255,47,158,0.55)]">
              drawing on the evidence
            </strong>
            .
          </h2>

          <ol className="mt-7 space-y-4">
            {STEPS.map((s) => (
              <li key={s.n} className="flex gap-4">
                <span className="mt-0.5 font-mono text-xs font-bold text-[var(--sodium)]">{s.n}</span>
                <div>
                  <p className="font-mono text-[11px] tracking-[0.2em] text-[var(--neon-cyan)]">
                    {s.head}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[var(--paper)]/60">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <p className="mt-7 border-t border-[var(--electric)]/15 pt-5 text-sm leading-6 text-[var(--paper)]/75">
            Looking is free. The string is free.{" "}
            <strong className="text-[var(--paper)]">The accusation is not.</strong> Every claim in it
            the photos do not back up is a wanted star, and it will not tell you which one. Five
            stars and you are finished.
          </p>

          <button
            onClick={() => {
              // This click is the browser's permission to make noise. Nothing
              // plays before it.
              voIntro();
              warm();
              onClose();
            }}
            className="mt-7 w-full select-none rounded bg-[var(--neon-pink)] py-3 font-mono text-xs font-bold tracking-[0.3em] text-[#1a0a14] shadow-[0_0_28px_rgba(255,47,158,0.45)] transition hover:brightness-110"
          >
            START
          </button>
        </div>
      </div>
    </div>
  );
}
