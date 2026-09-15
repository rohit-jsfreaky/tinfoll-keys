"use client";

/**
 * The accusation. The only judged moment in the game.
 *
 * Everything before this costs nothing — drawing is free, the string is free.
 * Here the player has to commit to a whole sentence with names in it, and each
 * claim the photographs do not support is a wanted star.
 *
 * Two things this screen deliberately does NOT do:
 *
 *   - It never says which claim was wrong. Only how many. Telling somebody
 *     "slot three is wrong" turns them into a search algorithm working by
 *     elimination; telling them "one of these four doesn't hold" makes them go
 *     back and look at the photographs again, which is the game.
 *   - It never stops the player submitting. Cal warns, and then gets out of the
 *     way. A man who talks you out of it is not a character, he is a tutorial.
 */

import { useEffect, useMemo, useState } from "react";
import type { CaseFile } from "@/lib/case";
import { MAX_STARS } from "@/lib/game";

export interface AccusationProps {
  file: CaseFile;
  stars: number;
  /** How many claims were unsupported last time, or -1 if never submitted. */
  lastWrong: number;
  busy?: boolean;
  onSubmit: (picks: Record<string, string>) => void;
  onClose: () => void;
}

export function Accusation({ file, stars, lastWrong, busy, onSubmit, onClose }: AccusationProps) {
  const { lead, template, slots } = file.accusation;
  const [picks, setPicks] = useState<Record<string, string>>({});
  /** Cleared the moment they change anything, so old feedback never misleads. */
  const [showResult, setShowResult] = useState(lastWrong > 0);

  useEffect(() => {
    setShowResult(lastWrong > 0);
  }, [lastWrong]);

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

  const complete = slots.every((s) => picks[s.id]);

  /** The sentence, with whatever has been chosen dropped into it. */
  const sentence = useMemo(() => {
    const parts = template.split(/(\{[\w-]+\})/g);
    return parts.map((part, i) => {
      const m = part.match(/^\{([\w-]+)\}$/);
      if (!m) return <span key={i}>{part}</span>;
      const slot = slots.find((s) => s.id === m[1]);
      const chosen = slot && picks[slot.id];
      const text = chosen ? slot.options.find((o) => o.id === chosen)?.text : null;
      return (
        <span
          key={i}
          className={
            text
              ? "font-bold text-[var(--neon-pink)]"
              : "text-[var(--paper)]/25 underline decoration-[var(--paper)]/25 underline-offset-4"
          }
        >
          {text ?? "        "}
        </span>
      );
    });
  }, [template, slots, picks]);

  const choose = (slotId: string, optionId: string) => {
    setShowResult(false);
    setPicks((p) => ({ ...p, [slotId]: optionId }));
  };

  return (
    <div className="thin-scroll absolute inset-0 z-30 overflow-y-auto bg-[var(--night-deep)]/96 backdrop-blur-sm">
      <div className="flex min-h-full items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-2xl rounded-lg border border-[var(--electric)]/22 bg-[var(--night)] p-8 shadow-[0_0_70px_rgba(59,155,255,0.14),0_30px_80px_rgba(0,0,0,0.85)]">
          <div className="flex items-baseline justify-between">
            <p className="font-mono text-[10px] tracking-[0.45em] text-[var(--neon-cyan)]">
              THE ACCUSATION
            </p>
            <div className="flex gap-1.5" aria-label={`${stars} of ${MAX_STARS} wanted stars`}>
              {Array.from({ length: MAX_STARS }, (_, i) => (
                <span
                  key={i}
                  className={`text-sm leading-none ${
                    i < stars
                      ? "text-[var(--wanted)] drop-shadow-[0_0_8px_rgba(229,52,42,0.9)]"
                      : "text-[var(--paper)]/15"
                  }`}
                >
                  ★
                </span>
              ))}
            </div>
          </div>

          <p className="mt-4 text-sm leading-6 text-[var(--paper)]/70">&ldquo;{lead}&rdquo;</p>

          {/* The whole claim, always visible, so they can read back what they
            * are about to say before they say it. */}
          <blockquote className="mt-6 border-l-2 border-[var(--neon-pink)]/50 bg-[var(--night-raised)]/60 py-4 pl-5 pr-4 font-serif text-lg leading-8 text-[var(--paper)]/90">
            {sentence}
          </blockquote>

          <div className="mt-7 space-y-5">
            {slots.map((slot) => (
              <div key={slot.id}>
                <p className="font-mono text-[11px] tracking-[0.2em] text-[var(--sodium)]">
                  {slot.question.toUpperCase()}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {slot.options.map((o) => {
                    const on = picks[slot.id] === o.id;
                    return (
                      <button
                        key={o.id}
                        onClick={() => choose(slot.id, o.id)}
                        className={`rounded border px-3 py-1.5 font-mono text-[11px] tracking-[0.12em] transition ${
                          on
                            ? "border-[var(--neon-pink)] bg-[var(--neon-pink)] font-bold text-[#1a0a14]"
                            : "border-[var(--paper)]/20 text-[var(--paper)]/65 hover:border-[var(--neon-pink)]/60 hover:text-[var(--paper)]"
                        }`}
                      >
                        {o.text}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* How many, never which. */}
          {showResult && lastWrong > 0 && (
            <div className="mt-7 rounded border border-[var(--wanted)]/35 bg-[var(--wanted)]/8 px-4 py-3">
              <p className="font-mono text-sm tracking-[0.2em] text-[var(--wanted)]">
                {lastWrong === 1 ? "1 CLAIM ISN'T SUPPORTED" : `${lastWrong} CLAIMS AREN'T SUPPORTED`}
              </p>
              <p className="mt-1.5 text-sm text-[var(--paper)]/60">
                &ldquo;
                {lastWrong === 1
                  ? "One part of that doesn't hold. Go back and look."
                  : "That's not what those photos say. Go back and look."}
                &rdquo;
              </p>
            </div>
          )}

          <div className="mt-7 flex items-center gap-3">
            <button
              onClick={onClose}
              className="rounded border border-[var(--paper)]/20 px-4 py-2.5 font-mono text-xs tracking-[0.2em] text-[var(--paper)]/60 transition hover:border-[var(--paper)]/50 hover:text-[var(--paper)]"
            >
              NOT YET
            </button>
            <button
              onClick={() => onSubmit(picks)}
              disabled={!complete || busy}
              className="flex-1 select-none rounded bg-[var(--neon-pink)] py-2.5 font-mono text-xs font-bold tracking-[0.3em] text-[#1a0a14] shadow-[0_0_28px_rgba(255,47,158,0.45)] transition hover:brightness-110 disabled:bg-[var(--paper)]/12 disabled:text-[var(--paper)]/35 disabled:shadow-none"
            >
              {complete ? "SAY IT" : "FINISH THE SENTENCE"}
            </button>
          </div>

          <p className="mt-4 text-center font-mono text-[10px] leading-4 tracking-[0.2em] text-[var(--paper)]/35">
            ONCE HIS NAME IS ON THIS, IT DOESN&rsquo;T COME BACK OFF
          </p>
        </div>
      </div>
    </div>
  );
}
