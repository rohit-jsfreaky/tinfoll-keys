"use client";

/**
 * The little that sits on screen while you play: the wanted stars, and a
 * one-line reaction to what you just did.
 *
 * The stars show from the very first connection, on purpose. CASES.md: "Show
 * the star bar from the first connection so the player learns the cost before
 * it hurts." Red is the only colour in the UI reserved for consequence.
 */

import { MAX_STARS } from "@/lib/game";

export interface HudProps {
  stars: number;
  /** Shown briefly under the crosshair after a connection. */
  toast: string | null;
  title: string;
  /**
   * How many of the clues Cal insists on are still missing.
   *
   * Deliberately the ONLY progress number on screen. It used to sit next to a
   * "6 / 11 FOUND" counter and the two read as a contradiction — eleven is every
   * clue in the case, five are the ones that open the accusation, and showing
   * both just made the player do arithmetic to find out they still disagreed.
   */
  left: number;
  visible: boolean;
}

export function Hud({ stars, toast, title, left, visible }: HudProps) {
  if (!visible) return null;
  return (
    <>
      <div className="pointer-events-none absolute left-6 top-5 font-mono text-[11px] tracking-[0.3em] text-[var(--neon-cyan)]/55">
        {title.toUpperCase()}
      </div>

      {/* One number, and only while it still means something. */}
      {left > 0 && (
        <div className="pointer-events-none absolute left-6 top-11 font-mono text-[10px] tracking-[0.25em] text-[var(--sodium)]/85">
          {left} MORE BEFORE CAL WILL NAME ANYBODY
        </div>
      )}

      <div className="pointer-events-none absolute right-6 top-5 flex gap-1.5" aria-label={`${stars} of ${MAX_STARS} wanted stars`}>
        {Array.from({ length: MAX_STARS }, (_, i) => (
          <span
            key={i}
            className={`text-xl leading-none transition-all duration-500 ${
              i < stars ? "text-[var(--wanted)] drop-shadow-[0_0_10px_rgba(229,52,42,0.95)]" : "text-[var(--paper)]/20"
            }`}
          >
            ★
          </span>
        ))}
      </div>

      {toast && (
        <p
          key={toast}
          className="pointer-events-none absolute left-1/2 top-[calc(50%-58px)] -translate-x-1/2 animate-[toast_2.2s_ease-out_forwards] font-mono text-sm tracking-[0.25em] text-[var(--paper)] drop-shadow-[0_1px_4px_rgba(0,0,0,0.95)]"
        >
          {toast}
        </p>
      )}

      <style>{`
        @keyframes toast {
          0% { opacity: 0; transform: translate(-50%, 6px); }
          12% { opacity: 1; transform: translate(-50%, 0); }
          75% { opacity: 1; }
          100% { opacity: 0; transform: translate(-50%, -8px); }
        }
      `}</style>
    </>
  );
}
