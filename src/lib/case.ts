/**
 * Case data types.
 *
 * A case is 14 photos. Six are evidence and carry hotspots. Eight are noise and
 * carry none — drawing on them costs nothing, because looking is free. Only
 * connecting is judged.
 */

import type { Hotspot } from "./hit-detect";

export interface CasePhoto {
  id: string;
  src: string;
  /** What Cal scribbled on the back. Shown on the board, never a hint. */
  caption: string;
  /** True for the six that belong in the chain. */
  evidence: boolean;
  /** Empty for noise photos. */
  hotspots: Hotspot[];
}

export interface CaseFile {
  id: string;
  title: string;
  place: string;
  /** What Cal reads out when the box is opened. */
  brief: string;
  photos: CasePhoto[];
  /** The six photo ids that must end up in one connected group to win. */
  chain: string[];
  endings: { win: string; lost: string };
}

/** Every hotspot in the case, flattened, for lookups. */
export function allHotspots(file: CaseFile): Hotspot[] {
  return file.photos.flatMap((p) => p.hotspots);
}

export function photoById(file: CaseFile, id: string): CasePhoto | undefined {
  return file.photos.find((p) => p.id === id);
}

/** A connection is clean only when both photos are evidence. */
export function isCleanLink(file: CaseFile, a: string, b: string): boolean {
  return !!photoById(file, a)?.evidence && !!photoById(file, b)?.evidence;
}
