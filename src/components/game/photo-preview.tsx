"use client";

/**
 * A photo off the board, held up close.
 *
 * On the corkboard a photo is about four centimetres across, which is right for
 * the room and useless for actually looking at anything. Right-clicking a pinned
 * photo lifts it off the wall so you can read it again — with your own marks on
 * it, and whatever it has already told you underneath.
 *
 * Right click rather than left, because left click is the red string and that is
 * the mechanic. Inspect-on-right-click is what games do anyway.
 */

import { useEffect } from "react";
import type { CasePhoto } from "@/lib/case";
import { Zoomable } from "./zoomable";

export function PhotoPreview({
  photo,
  src,
  clues,
  onClose,
}: {
  photo: CasePhoto;
  /** The marked version if the player drew on it, otherwise the original. */
  src: string;
  clues: string[];
  onClose: () => void;
}) {
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
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-[var(--night-deep)]/92 p-6 backdrop-blur-sm md:p-12"
      onClick={onClose}
      /*
       * Swallow the menu, but do NOT close on it.
       *
       * The board opens this on mousedown, because a locked pointer eats the
       * contextmenu event. The mouse is released the instant this appears, so
       * the contextmenu that follows the same right click lands here — and
       * closing on it meant the photo was only up while the button was held.
       */
      onContextMenu={(e) => e.preventDefault()}
    >
      <div onClick={(e) => e.stopPropagation()} className="flex flex-col items-center">
        {/*
          * The paper border, so it still reads as a print off the wall.
          *
          * The paper sizes itself around the photo — it is NOT a flex child that
          * has to fit a leftover height, which is what made the image spill past
          * the cream edge on the right and bottom. Width is capped so that the
          * 4:3 photo plus its caption always fits the screen, and the photo box
          * is exactly 4:3 like every file in the case, so the border is an even
          * margin the whole way round.
          */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative w-full rotate-[-0.5deg] bg-[var(--paper)] p-2 shadow-[0_0_60px_rgba(255,47,158,0.2),0_30px_80px_rgba(0,0,0,0.8)]"
          style={{ maxWidth: "min(48rem, calc(72vh * 4 / 3))" }}
        >
          <Zoomable
            src={src}
            alt={photo.caption}
            fit="cover"
            priority
            unoptimized={src !== photo.src}
            sizes="(max-width: 768px) 100vw, 48rem"
            className="aspect-[4/3] w-full"
          />
          <p className="px-1 pb-1 pt-2 text-center font-mono text-[11px] tracking-widest text-[#1a1714]/70">
            {photo.caption}
          </p>
        </div>

        {clues.length > 0 && (
          <div className="mt-4 space-y-1.5">
            {clues.map((c) => (
              <p key={c} className="text-center text-sm text-[var(--neon-cyan)]/90">
                &ldquo;{c}&rdquo;
              </p>
            ))}
          </div>
        )}

        <p className="mt-4 text-center font-mono text-[10px] tracking-[0.3em] text-[var(--electric)]/60">
          CLICK THE PHOTO TO ZOOM &middot; CLICK OUTSIDE TO PUT IT BACK
        </p>
      </div>
    </div>
  );
}
