"use client";

/**
 * The loading screen.
 *
 * The room is 41 models and 21MB. Loading them all at once locks the browser
 * for several seconds and the first thing a judge sees is a stutter. So the
 * scene mounts in tiers — walls and board first, then the big furniture, then
 * the clutter — and this sits over the top until every tier has settled.
 *
 * Nothing is shown of the room until it is all in. A half-built room looks
 * broken; a loading screen looks deliberate.
 *
 * The panels are the cast of this case — Luis, Victor, Sofia, the yard —
 * painted rather than photographed. That is the point of them: the fourteen
 * photographs are deliberately drab, because they are meant to look like
 * somebody's surveillance pictures. The loading screen is the only place the
 * game gets to say "this is a crime story about these people" before you have
 * met any of them, so it is the one place that is allowed to look like a
 * poster.
 */

import { useEffect, useState } from "react";
import Image from "next/image";
import { useProgress } from "@react-three/drei";

/** How many tiers RoomProps splits itself into. */
export const TIERS = 3;

/**
 * The panels, in the order they are shown.
 *
 * They run dusk, dusk, dusk, night — so watching the cycle is watching the day
 * go down on the place. The empty yard establishes it, then the office, then
 * the woman who lost a car, and last the man who owns the yard, at three in the
 * morning. By the time somebody has seen all four they have met the person they
 * will be asked to accuse, which is the whole reason this screen has faces on
 * it at all.
 */
const PANELS = [
  {
    src: "/load/load-yard.jpg",
    who: "THE YARD",
    line: "Twenty-four hours. Behind the strip mall.",
  },
  {
    src: "/load/load-office.jpg",
    who: "SUNSTATE RECOVERY",
    line: "The office. Lights on all night.",
  },
  {
    src: "/load/load-sofia.jpg",
    who: "SOFIA REYES",
    line: "Reported her car. Nobody called back.",
  },
  {
    src: "/load/load-victor.jpg",
    who: "VICTOR SALAZAR",
    line: "Owns it. Signs everything.",
  },
] as const;

/** A beat per plate. Short enough that the screen always looks busy. */
const PANEL_MS = 2000;

/**
 * One trip through every plate.
 *
 * The `plate` keyframes in globals.css hold each plate up for roughly the
 * first quarter of the cycle, so they are written for exactly four plates.
 * Adding or removing one means moving those percentages too.
 */
const CYCLE_MS = PANEL_MS * PANELS.length;

export function useLoadTiers(): { tier: number; done: boolean } {
  const { active } = useProgress();
  const [tier, setTier] = useState(1);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (active) return;
    // A beat of quiet before the next tier, so a slow decode is not mistaken
    // for "finished".
    const t = setTimeout(() => {
      if (tier < TIERS) setTier((n) => n + 1);
      else setDone(true);
    }, 260);
    return () => clearTimeout(t);
  }, [active, tier]);

  return { tier, done };
}

export function Boot({ tier, done }: { tier: number; done: boolean }) {
  const { progress } = useProgress();
  const [held, setHeld] = useState(true);

  // Hold the curtain a moment after the last tier, so the room is settled and
  // lit before anyone sees it.
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setHeld(false), 500);
    return () => clearTimeout(t);
  }, [done]);

  if (!held) return null;

  // Each tier is a slice of the bar, so it fills once across the whole load
  // rather than snapping back to zero three times.
  const overall = Math.min(100, ((tier - 1) / TIERS) * 100 + progress / TIERS);

  return (
    <div
      className={`absolute inset-0 z-40 overflow-hidden transition-opacity duration-500 ${
        done ? "opacity-0" : "opacity-100"
      }`}
      style={{
        // Shows through before the art decodes, and behind any panel that
        // fails to load at all. A Vice City night rather than a black room.
        background:
          "radial-gradient(120% 90% at 16% 6%, rgba(255,47,158,0.17) 0%, rgba(0,0,0,0) 55%)," +
          "radial-gradient(110% 90% at 90% 94%, rgba(47,201,240,0.15) 0%, rgba(0,0,0,0) 55%)," +
          "var(--night-deep)",
      }}
    >
      {/*
        All four are mounted and crossfaded rather than swapped. Swapping the
        src shows a frame of nothing every four seconds on a slow connection,
        which is exactly the connection this screen exists for.
      */}
      {PANELS.map((p, i) => (
        <Image
          key={p.src}
          src={p.src}
          alt=""
          fill
          // All three are fetched up front. They are shown a second apart and
          // the network is already saturated by the room, so anything loaded
          // lazily arrives after its turn has passed.
          priority
          sizes="100vw"
          // The plates are 16:9 and the game is usually wider than that, so the
          // crop bites off the top and bottom rather than the sides. Pulled
          // slightly above centre: what gets lost underneath is empty asphalt,
          // and what would get lost above is somebody's head.
          className="object-cover object-[50%_42%] opacity-0"
          style={{
            animation: `plate ${CYCLE_MS}ms linear infinite`,
            animationDelay: `${i * PANEL_MS}ms`,
          }}
        />
      ))}

      {/* Lets the type sit on the art without a box around it. */}
      <div className="absolute inset-0 bg-gradient-to-t from-[var(--night-deep)] via-[var(--night-deep)]/55 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-[var(--night-deep)]/80 via-transparent to-transparent" />

      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-6 p-7 md:flex-row md:items-end md:justify-between md:p-14">
        <div className="min-w-0">
          <p className="font-mono text-[10px] tracking-[0.5em] text-[var(--neon-cyan)]">
            PORT GELLHORN, LEONIDA
          </p>
          <h1
            className="mt-3 font-mono text-4xl font-black tracking-[0.18em] text-[var(--paper)] md:text-6xl"
            style={{ textShadow: "0 0 40px rgba(255,47,158,0.55)" }}
          >
            TINFOIL KEYS
          </h1>
          <p className="mt-2 max-w-md text-sm text-[var(--paper)]/55">
            A detective game where you solve the case by drawing on the evidence.
          </p>
        </div>

        <div className="shrink-0 md:text-right">
          {/*
            Every caption is mounted and runs the same cycle as its plate, on
            the same delay. Picking one in React would put the name back on the
            main thread — which is the thread that is busy — and the label would
            drift off the face it belongs to.
          */}
          <div className="relative h-11">
            {PANELS.map((p, i) => (
              <div
                key={p.src}
                className="absolute inset-x-0 top-0 opacity-0"
                style={{
                  animation: `plate ${CYCLE_MS}ms linear infinite`,
                  animationDelay: `${i * PANEL_MS}ms`,
                }}
              >
                <p className="font-mono text-xs tracking-[0.3em] text-[var(--sodium)]">
                  {p.who}
                </p>
                <p className="mt-1 text-sm text-[var(--paper)]/45">{p.line}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 flex items-center gap-3 md:justify-end">
            <div className="h-[3px] w-48 overflow-hidden rounded-full bg-[var(--paper)]/12">
              <div
                className="h-full rounded-full bg-[var(--neon-pink)] shadow-[0_0_16px_rgba(255,47,158,0.8)] transition-[width] duration-300 ease-out"
                style={{ width: `${overall}%` }}
              />
            </div>
            <p className="w-12 font-mono text-[10px] tracking-[0.2em] text-[var(--sodium)]/80">
              {done ? "READY" : `${Math.round(overall)}%`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
