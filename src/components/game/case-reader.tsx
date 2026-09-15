"use client";

/**
 * The case file, opened like a document in a game: one page at a time, on
 * paper, with the room dark behind it. Escape or a click outside puts it back.
 *
 * This is the first thing a player should read, and it is where the story
 * lives — the brief on the board is two lines, this is the rest of it.
 */

import { useEffect, useState } from "react";
import type { CaseFile } from "@/lib/case";
import { stop, voStory } from "@/lib/vo";

export function CaseReader({ file, onClose }: { file: CaseFile; onClose: () => void }) {
  const pages = file.story ?? [{ title: file.title, body: [file.brief] }];
  const [page, setPage] = useState(0);
  const last = pages.length - 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      } else if (e.key === "ArrowRight" || e.key === " ") setPage((p) => Math.min(last, p + 1));
      else if (e.key === "ArrowLeft") setPage((p) => Math.max(0, p - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [last, onClose]);

  // Cal reads whichever page is open, and shuts up when it closes. The page
  // number is 1-based to match the file names.
  useEffect(() => {
    voStory(page + 1);
  }, [page]);
  useEffect(() => stop, []);

  const current = pages[page];

  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center bg-[var(--night-deep)]/88 p-6 backdrop-blur-[2px]"
      onClick={onClose}
    >
      {/*
        * The paper is ONE fixed size for every page.
        *
        * It used to grow with whatever was written on it, so a longer page made
        * the sheet taller and the buttons at the bottom moved down with it —
        * click NEXT twice and the button has walked out from under the cursor.
        * Now the sheet is a fixed 42rem x 36rem, the header and footer are
        * pinned, and only the middle scrolls. Nothing on this card moves when
        * the page turns.
        */}
      <article
        onClick={(e) => e.stopPropagation()}
        className="relative flex h-[36rem] max-h-[88vh] w-full max-w-[42rem] rotate-[-0.6deg] flex-col overflow-hidden bg-[#efe7d8] px-10 pb-8 pt-9 text-[#1a1714] shadow-[0_0_70px_rgba(255,47,158,0.22),0_30px_80px_rgba(0,0,0,0.75)]"
      >
        {/* A printed magenta edge along the top. One flat colour, no gradient —
          * it reads as a case folder, and it ties the paper to the room. */}
        <span className="absolute inset-x-0 top-0 h-[3px] bg-[var(--neon-pink)]" />
        {/* a pin through the top, so it reads as the same paper that was on the wall */}
        <span className="absolute left-1/2 top-4 h-3 w-3 -translate-x-1/2 rounded-full bg-[var(--neon-pink)] shadow-[0_2px_4px_rgba(0,0,0,0.45),0_0_12px_rgba(255,47,158,0.9)]" />

        <p className="font-mono text-[10px] tracking-[0.35em] text-[#1a1714]/45">
          {file.place.toUpperCase()} ·{" "}
          <span className="text-[#c11c73]">
            PAGE {page + 1} OF {pages.length}
          </span>
        </p>
        <h2 className="mt-3 font-mono text-lg font-bold tracking-[0.12em]">{current.title}</h2>
        <span className="mt-4 block h-px w-16 shrink-0 bg-[var(--neon-pink)]" />

        {/* The only part that is allowed to change size, and it scrolls instead. */}
        <div className="thin-scroll-dark mt-5 min-h-0 flex-1 space-y-4 overflow-y-auto pr-2 font-serif text-[17px] leading-7">
          {current.body.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>

        {/*
          * Both buttons are a fixed width and the middle takes the rest, so the
          * row does not shuffle when NEXT becomes GOT IT on the last page.
          */}
        <footer className="mt-6 flex shrink-0 select-none items-center border-t border-[#1a1714]/12 pt-5 font-mono text-xs tracking-widest">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="w-28 shrink-0 rounded border border-[#1a1714]/25 py-1.5 text-center transition hover:border-[var(--neon-pink)] hover:text-[#c11c73] disabled:opacity-20 disabled:hover:border-[#1a1714]/25 disabled:hover:text-inherit"
          >
            ← BACK
          </button>
          <span className="flex-1 text-center text-[#136f96]/70">ESC TO CLOSE</span>
          {page < last ? (
            <button
              onClick={() => setPage((p) => Math.min(last, p + 1))}
              className="w-28 shrink-0 rounded bg-[var(--neon-pink)] py-1.5 text-center font-bold text-[#1a0a14] shadow-[0_0_18px_rgba(255,47,158,0.45)] transition hover:brightness-110"
            >
              NEXT →
            </button>
          ) : (
            <button
              onClick={onClose}
              className="w-28 shrink-0 rounded bg-[var(--neon-pink)] py-1.5 text-center font-bold text-[#1a0a14] shadow-[0_0_18px_rgba(255,47,158,0.45)] transition hover:brightness-110"
            >
              GOT IT
            </button>
          )}
        </footer>
      </article>
    </div>
  );
}
