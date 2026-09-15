/**
 * Case data types.
 *
 * A case is 14 photographs and one accusation.
 *
 * The photos are not split into "evidence" and "junk" any more. That split was
 * the thing that broke the old case: the moment a mark landed you knew which
 * pile a photo was in, and the rest of the game had no decision left in it.
 * Now every photo carries something — a fact about the crime, a fact about a
 * person, or context that only means anything later. There is no garbage pile,
 * only things you understand yet and things you do not.
 *
 * Nothing is judged until the end. The board is a scratchpad; the string costs
 * nothing. The game speaks exactly once, when you state the accusation, and
 * even then it will not tell you WHICH part was wrong — only how many parts.
 * Attributable feedback turns a player into a search algorithm.
 */

import type { Hotspot } from "./hit-detect";

/**
 * What a photo is for.
 *
 * `crime` proves the operation. `turn` is the chain about the person. `context`
 * has nothing to find and exists so you know who these people are — which is
 * what makes the last question hurt.
 */
export type PhotoRole = "crime" | "turn" | "context";

/** Who is talking under the photo. Cal suspects. Mateo remembers. */
export type Voice = "cal" | "mateo";

export interface CasePhoto {
  id: string;
  src: string;
  /** One line under the photo. Never a hint — it only points the eye. */
  caption: string;
  voice: Voice;
  role: PhotoRole;
  /** Empty on context photos. */
  hotspots: Hotspot[];
}

export interface AccusationOption {
  id: string;
  text: string;
}

export interface AccusationSlot {
  id: string;
  /** Cal's question, above the choices. */
  question: string;
  options: AccusationOption[];
  /** The one option the photographs actually support. */
  answer: string;
}

export interface Accusation {
  /** What Cal says when the board is ready. */
  lead: string;
  /**
   * The sentence, with {slot-id} where each choice goes. The player is stating
   * a whole thought, not filling a form — a shaped claim is what turns a hunch
   * into a commitment you can be wrong about.
   */
  template: string;
  slots: AccusationSlot[];
}

/**
 * The card that opens before anything else.
 *
 * Five blocks, each answering one question a new player actually has: who am I,
 * who is he, what happened tonight, what does he want, and what is at stake.
 * Without it the game opens on a stranger's living room and a wall of photos,
 * and a judge spends their first minute working out what they are looking at.
 */
export interface Briefing {
  title: string;
  blocks: Array<{ head: string; body: string }>;
}

export interface CaseFile {
  id: string;
  title: string;
  place: string;
  briefing?: Briefing;
  /** Two lines on the board. */
  brief: string;
  photos: CasePhoto[];
  /**
   * Clue ids that must be found before Cal will let you name anybody.
   *
   * This is a deliberate rail. A judge has three minutes, and one who reaches
   * the accusation without having walked the chain about Luis will name him and
   * never understand why that was the wrong answer — they will conclude the
   * story simply is not there.
   */
  required: string[];
  accusation: Accusation;
  endings: { win: string; lost: string };
  /** The pages pinned to the wall. Read first, and they name no tells. */
  story?: StoryPage[];
}

export interface StoryPage {
  title: string;
  /** Paragraphs. Kept as an array so the reader can lay them out itself. */
  body: string[];
}

/** Every hotspot in the case, flattened, for lookups. */
export function allHotspots(file: CaseFile): Hotspot[] {
  return file.photos.flatMap((p) => p.hotspots);
}

export function photoById(file: CaseFile, id: string): CasePhoto | undefined {
  return file.photos.find((p) => p.id === id);
}
