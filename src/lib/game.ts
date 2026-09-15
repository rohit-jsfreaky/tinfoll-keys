/**
 * The rules of the game, with nothing else in them.
 *
 * No React, no three.js, no DOM. Every function takes a state and returns a new
 * one, so the whole rule set can be tested in a millisecond without a browser —
 * and the room, the overlays and the save file all just read from it.
 *
 * THE RULES
 *
 *   - Looking is free. Drawing on a photo never costs anything, ever.
 *   - A photo that hides something cannot go on the board until you have drawn
 *     on the right part of it. That is what makes the image editor the game
 *     rather than a feature bolted on.
 *   - The string is free too. It is a scratchpad. Connect anything you like.
 *   - Exactly one thing is judged: the accusation. Each claim in it the
 *     photographs do not support is one wanted star. Five stars is WASTED.
 *
 * The last two rules are the ones that changed, and they changed for a reason.
 * Scoring each string told the player precisely which connection was wrong,
 * which turns a person into a search algorithm — they stop thinking and start
 * bisecting. Now the game answers once, and even then it only says HOW MANY
 * claims are unsupported, never which. "Something in here is wrong" makes you
 * reason. "Slot three is wrong" makes you click.
 */

import type { CaseFile } from "./case";

export const MAX_STARS = 5;

/** Hints in a playthrough. A limit, so spending one is still a decision. */
export const MAX_HINTS = 5;

export type Phase = "playing" | "cracked" | "wasted";

export interface GameState {
  caseId: string;
  /** Hotspot ids the player has drawn on correctly. */
  found: string[];
  /** Photo ids on the board, in the order they went up. */
  pinned: string[];
  /** Pairs of photo ids joined by red string. Never judged. */
  links: Array<[string, string]>;
  stars: number;
  phase: Phase;
  /** Slot ids from the last accusation, so the board can be rebuilt on reload. */
  picks: Record<string, string>;
  /** How many claims were unsupported last time. -1 means never submitted. */
  lastWrong: number;
  hintsUsed: number;
  /**
   * Hotspots a hint has already pointed at.
   *
   * Asking twice about the same thing must not cost twice. Without this, a
   * player who read a hint, went and looked, failed to spot it and came back
   * was charged again for the identical sentence.
   */
  hintsSeen: string[];
}

export function newGame(caseId: string): GameState {
  return {
    caseId,
    found: [],
    pinned: [],
    links: [],
    stars: 0,
    phase: "playing",
    picks: {},
    lastWrong: -1,
    hintsUsed: 0,
    hintsSeen: [],
  };
}

export function findClues(state: GameState, hotspotIds: string[]): GameState {
  const found = [...new Set([...state.found, ...hotspotIds])];
  return found.length === state.found.length ? state : { ...state, found };
}

/**
 * Whether a photo is allowed on the board yet.
 *
 * A photo that is hiding something has to be earned: you have to have drawn on
 * the right part of it first. A photo with nothing on it goes up freely — the
 * context photos are not junk, they are how you learn who these people are, and
 * the player should be able to put them up alongside the proof.
 */
export function canPin(file: CaseFile, found: string[], photoId: string): boolean {
  const photo = file.photos.find((p) => p.id === photoId);
  if (!photo) return false;
  const spots = photo.hotspots ?? [];
  if (spots.length === 0) return true;
  return spots.some((h) => found.includes(h.id));
}

export function pin(state: GameState, file: CaseFile, photoId: string): GameState {
  if (state.pinned.includes(photoId)) return state;
  if (!canPin(file, state.found, photoId)) return state;
  return { ...state, pinned: [...state.pinned, photoId] };
}

export type LinkOutcome =
  | "same" // clicked the same photo twice
  | "not-pinned" // one of them is not on the board
  | "already" // that string is already there
  | "over" // the game is finished
  | "tied"; // done

function sameLink(a: [string, string], b: [string, string]): boolean {
  return (a[0] === b[0] && a[1] === b[1]) || (a[0] === b[1] && a[1] === b[0]);
}

/**
 * Tie two pinned photos together. Costs nothing and proves nothing.
 *
 * The board belongs to the player. Some people group by person, some by night,
 * some by nothing at all — and none of that should be marked, because the
 * moment it is marked it stops being thinking and becomes a puzzle to solve by
 * elimination.
 */
export function link(
  state: GameState,
  file: CaseFile,
  a: string,
  b: string,
): { outcome: LinkOutcome; state: GameState } {
  if (state.phase !== "playing") return { outcome: "over", state };
  if (a === b) return { outcome: "same", state };
  if (!state.pinned.includes(a) || !state.pinned.includes(b)) {
    return { outcome: "not-pinned", state };
  }
  const pair: [string, string] = [a, b];
  if (state.links.some((l) => sameLink(l, pair))) return { outcome: "already", state };
  return { outcome: "tied", state: { ...state, links: [...state.links, pair] } };
}

export function unlink(state: GameState, a: string, b: string): GameState {
  const pair: [string, string] = [a, b];
  const links = state.links.filter((l) => !sameLink(l, pair));
  return links.length === state.links.length ? state : { ...state, links };
}

/* ------------------------------------------------------------------ */
/* the accusation                                                      */
/* ------------------------------------------------------------------ */

/**
 * Cal will not let you name anybody until you have worked out who the man in
 * the photographs is.
 *
 * This is a rail and it is deliberate. Somebody who reaches the accusation
 * without the chain about Luis will name him, get it wrong, and never find out
 * why — they will leave thinking the game had no story in it.
 */
export function canAccuse(file: CaseFile, found: string[]): boolean {
  return file.required.every((id) => found.includes(id));
}

/** How many of the required clues are still missing. Drives the "not yet" line. */
export function missingRequired(file: CaseFile, found: string[]): number {
  return file.required.filter((id) => !found.includes(id)).length;
}

export type AccuseOutcome =
  | "incomplete" // a slot was left empty
  | "over" // already finished
  | "short" // some claims unsupported, still alive
  | "wasted" // that pushed the stars to five
  | "cracked"; // every claim supported

export interface AccuseResult {
  outcome: AccuseOutcome;
  /** How many claims the photographs do not support. */
  wrong: number;
  state: GameState;
}

/**
 * State the accusation. The only judged moment in the game.
 *
 * Note what this does NOT return: which slot was wrong. The caller could not
 * tell the player even if it wanted to.
 */
export function accuse(
  state: GameState,
  file: CaseFile,
  picks: Record<string, string>,
): AccuseResult {
  if (state.phase !== "playing") return { outcome: "over", wrong: 0, state };

  const slots = file.accusation.slots;
  if (slots.some((s) => !picks[s.id])) {
    return { outcome: "incomplete", wrong: 0, state };
  }

  const wrong = slots.filter((s) => picks[s.id] !== s.answer).length;
  const stars = Math.min(MAX_STARS, state.stars + wrong);
  const next: GameState = { ...state, picks: { ...picks }, lastWrong: wrong, stars };

  if (wrong === 0) return { outcome: "cracked", wrong, state: { ...next, phase: "cracked" } };
  if (stars >= MAX_STARS) return { outcome: "wasted", wrong, state: { ...next, phase: "wasted" } };
  return { outcome: "short", wrong, state: next };
}

/* ------------------------------------------------------------------ */
/* the rail                                                            */
/* ------------------------------------------------------------------ */

/**
 * The next photo the player should be looking at, or null when they are free.
 *
 * Once enough of the crime is proved, the game quietly stops caring about the
 * rest of it and starts walking the player through the chain about Luis, one
 * photo at a time. The tray surfaces whatever this returns. It is not a quest
 * marker — the photo just ends up on top of the pile, which is what would
 * happen if somebody handed it to you.
 */
export function nextInChain(file: CaseFile, found: string[]): string | null {
  const crimeFound = file.photos
    .filter((p) => p.role === "crime")
    .filter((p) => p.hotspots.some((h) => found.includes(h.id))).length;
  if (crimeFound < 3) return null;

  for (const id of file.required) {
    if (found.includes(id)) continue;
    const photo = file.photos.find((p) => p.hotspots.some((h) => h.id === id));
    if (photo) return photo.id;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* hints                                                               */
/* ------------------------------------------------------------------ */

export interface Hint {
  hotspotId: string;
  photoId: string;
  /** The photo's own path, so nothing has to rebuild it. */
  src: string;
  /** The line under the photo, so the player can find it in the box. */
  caption: string;
  /** What to look at. Describes the object, never a position on screen. */
  hint: string;
}

/**
 * The most useful thing to point at right now.
 *
 * Follows the same order the game already leads in: prove the yard is dirty
 * first, then walk the chain about Luis. A hint that jumped straight to the
 * twist would hand over the only surprise in the game.
 */
export function nextHint(file: CaseFile, found: string[]): Hint | null {
  const make = (photoId: string, hotspotId: string, hint: string): Hint => {
    const photo = file.photos.find((p) => p.id === photoId)!;
    return { hotspotId, photoId, src: photo.src, caption: photo.caption, hint };
  };

  const unfoundIn = (role: string) => {
    for (const p of file.photos.filter((x) => x.role === role)) {
      const spot = p.hotspots.find((h) => !found.includes(h.id) && h.hint);
      if (spot) return make(p.id, spot.id, spot.hint!);
    }
    return null;
  };

  // Still proving the crime: point at the yard.
  if (crimeProved(file, found) < 3) {
    const crime = unfoundIn("crime");
    if (crime) return crime;
  }

  // Otherwise follow the required chain, in the order the case lists it.
  for (const id of file.required) {
    if (found.includes(id)) continue;
    for (const p of file.photos) {
      const spot = p.hotspots.find((h) => h.id === id && h.hint);
      if (spot) return make(p.id, spot.id, spot.hint!);
    }
  }

  return unfoundIn("crime") ?? unfoundIn("turn");
}

/**
 * Spend a hint — but only if this is a new one.
 *
 * Re-reading something you were already told is free. The five are for five
 * different problems, not for five glances at the same sentence.
 */
export function useHint(state: GameState, hotspotId: string): GameState {
  if (state.hintsSeen.includes(hotspotId)) return state;
  if (state.hintsUsed >= MAX_HINTS) return state;
  return {
    ...state,
    hintsUsed: state.hintsUsed + 1,
    hintsSeen: [...state.hintsSeen, hotspotId],
  };
}

/** Whether asking for this one would cost anything. */
export function hintIsFree(state: GameState, hotspotId: string): boolean {
  return state.hintsSeen.includes(hotspotId);
}

/** Crime clues found, for the "fine, the yard's dirty" beat. */
export function crimeProved(file: CaseFile, found: string[]): number {
  return file.photos
    .filter((p) => p.role === "crime")
    .filter((p) => p.hotspots.some((h) => found.includes(h.id))).length;
}

/* ------------------------------------------------------------------ */
/* the save file                                                       */
/* ------------------------------------------------------------------ */

const KEY = (caseId: string) => `tinfoil-keys:save:${caseId}`;

export function saveGame(state: GameState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY(state.caseId), JSON.stringify(state));
  } catch {
    /* a full disk should never take the game down */
  }
}

export function loadGame(caseId: string): GameState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY(caseId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GameState>;
    // Anything saved by an older build is thrown away rather than half-trusted.
    if (!parsed || parsed.caseId !== caseId || !Array.isArray(parsed.found)) return null;
    return { ...newGame(caseId), ...parsed };
  } catch {
    return null;
  }
}

export function clearGame(caseId: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY(caseId));
  } catch {
    /* nothing to do */
  }
}
