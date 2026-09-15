"use client";

/**
 * A photo you can get close to.
 *
 * The whole game is spotting a small thing in a big picture — a pink flamingo
 * hanging off a mirror, a name on a strip of tape, whether two plates read the
 * same. At the size these display, several of those are right at the edge of
 * legible, and a player who cannot lean in just gives up and assumes the photo
 * is empty.
 *
 * Click anywhere and it zooms to that point. Click again and it goes further.
 * Click a third time and you are back out. There is also a button, because a
 * click-cycle is only obvious once you have already found it.
 *
 * Zooming is done with a CSS transform and a transform-origin set to wherever
 * you clicked, so it costs nothing and it never resamples the image — at 4x the
 * browser is showing you real pixels from the original file.
 */

import { useCallback, useState } from "react";
import Image from "next/image";

/** Click through these in order, then back to the start. */
const STEPS = [1, 2.5, 4] as const;

export interface ZoomableProps {
  src: string;
  alt: string;
  /** Data URLs cannot go through Next's image optimiser. */
  unoptimized?: boolean;
  priority?: boolean;
  /** object-contain keeps the whole frame; object-cover fills a fixed box. */
  fit?: "contain" | "cover";
  sizes?: string;
  className?: string;
}

export function Zoomable({
  src,
  alt,
  unoptimized,
  priority,
  fit = "contain",
  sizes = "100vw",
  className = "",
}: ZoomableProps) {
  const [step, setStep] = useState(0);
  const [origin, setOrigin] = useState({ x: 50, y: 50 });
  const scale = STEPS[step];

  const onClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    // Where in the picture the click landed, as a percentage. Used as the
    // transform origin so the thing under the cursor stays under the cursor.
    setOrigin({
      x: ((e.clientX - box.left) / box.width) * 100,
      y: ((e.clientY - box.top) / box.height) * 100,
    });
    setStep((s) => (s + 1) % STEPS.length);
  }, []);

  const reset = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setStep(0);
    setOrigin({ x: 50, y: 50 });
  }, []);

  return (
    <div
      onClick={onClick}
      className={`relative select-none overflow-hidden ${
        step === STEPS.length - 1 ? "cursor-zoom-out" : "cursor-zoom-in"
      } ${className}`}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        unoptimized={unoptimized}
        className={`transition-transform duration-200 ease-out ${
          fit === "cover" ? "object-cover" : "object-contain"
        }`}
        style={{ transform: `scale(${scale})`, transformOrigin: `${origin.x}% ${origin.y}%` }}
      />

      {/* Only says anything once it is doing something. */}
      {step > 0 && (
        <button
          onClick={reset}
          className="absolute right-3 top-3 z-10 rounded border border-[var(--paper)]/25 bg-[var(--night-deep)]/80 px-3 py-1.5 font-mono text-[10px] tracking-[0.2em] text-[var(--paper)]/85 backdrop-blur-sm transition hover:border-[var(--sodium)] hover:text-[var(--sodium)]"
        >
          {scale}&times; &middot; RESET
        </button>
      )}

      {step === 0 && (
        <span className="pointer-events-none absolute bottom-3 right-3 rounded bg-[var(--night-deep)]/70 px-2.5 py-1 font-mono text-[10px] tracking-[0.2em] text-[var(--paper)]/45 backdrop-blur-sm">
          CLICK TO ZOOM
        </span>
      )}
    </div>
  );
}
