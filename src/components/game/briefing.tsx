"use client";

/**
 * The briefing. Who you are, who he is, and why you are standing in his flat.
 *
 * This card exists because the game used to drop you into a stranger's living
 * room at one in the morning with no idea who anybody was. The case file on the
 * wall has the story in it, but you have to find it and click it first, and by
 * then you have already spent a minute confused — which for a judge with three
 * minutes is most of their patience gone.
 *
 * So this opens on its own, every load, before the how-to card. Story first,
 * then rules. It is deliberately short: five blocks, each one answering a single
 * question a new player would actually ask.
 */

import { useEffect } from "react";
import type { CaseFile } from "@/lib/case";

export function Briefing({ file, onClose }: { file: CaseFile; onClose: () => void }) {
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

  const brief = file.briefing;
  if (!brief) return null;

  return (
    // Scroll lives on the backdrop so a tall card keeps its top and bottom
    // margin instead of being clipped flush against both edges.
    <div
      className="thin-scroll absolute inset-0 z-30 overflow-y-auto bg-[var(--night-deep)]/95 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="flex min-h-full items-center justify-center p-6 md:p-10">
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-xl rounded-lg border border-[var(--sodium)]/25 bg-[var(--night)] p-8 shadow-[0_0_70px_rgba(240,147,47,0.12),0_30px_80px_rgba(0,0,0,0.85)]"
        >
          <p className="font-mono text-[10px] tracking-[0.45em] text-[var(--sodium)]">
            {file.place.toUpperCase()} &middot; 1:00 AM
          </p>
          <h2 className="mt-3 font-mono text-2xl font-black tracking-[0.06em] text-[var(--paper)]">
            {brief.title}
          </h2>

          <div className="mt-7 space-y-5">
            {brief.blocks.map((b) => (
              <div key={b.head}>
                <p className="font-mono text-[11px] tracking-[0.2em] text-[var(--neon-cyan)]">
                  {b.head}
                </p>
                <p className="mt-1.5 text-sm leading-6 text-[var(--paper)]/70">{b.body}</p>
              </div>
            ))}
          </div>

          <button
            onClick={onClose}
            className="mt-8 w-full select-none rounded bg-[var(--neon-pink)] py-3 font-mono text-xs font-bold tracking-[0.3em] text-[#1a0a14] shadow-[0_0_28px_rgba(255,47,158,0.45)] transition hover:brightness-110"
          >
            GO UP
          </button>
        </div>
      </div>
    </div>
  );
}
