"use client";

/**
 * The photos as the player left them.
 *
 * When you draw on a photo, that drawing IS your work — it is the accusation.
 * Throwing it away the moment the editor closes made the game feel like it was
 * not listening: you would go back to a photo you had circled and find it clean
 * again, and the copy that went up on the corkboard was the untouched original.
 *
 * So every save is kept here, and the marked version is what shows everywhere
 * afterwards: in the box, on the big view, and pinned to the board.
 *
 * Stored in localStorage next to the save file, so a judge who closes the tab
 * comes back to their own board with their own marks on it.
 *
 * The one thing to be careful about is size. The editor hands back a full-size
 * PNG, which is well over a megabyte, and localStorage gives you about five for
 * everything. Every mark is re-encoded to a JPEG first, and if the browser still
 * says no, the oldest marks are dropped until the newest one fits — losing an
 * old drawing is much better than silently failing to save the new one.
 */

const KEY = (caseId: string) => `tinfoil-keys:marks:${caseId}`;

/** photo id -> data URL of that photo with the player's marks on it. */
export type Marks = Record<string, string>;

/** Long edge of a stored mark, and how hard it is squashed. */
const MAX_W = 1024;
const QUALITY = 0.72;

/**
 * Re-encode a saved image as a JPEG small enough to keep.
 *
 * The stored copy is only ever looked at, never diffed — hit detection always
 * runs against the original file — so quality here is a display decision, not a
 * correctness one.
 */
export function compressMark(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_W / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("no 2d context"));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", QUALITY));
    };
    img.onerror = () => reject(new Error("could not read the saved image"));
    img.src = dataUrl;
  });
}

export function loadMarks(caseId: string): Marks {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY(caseId));
    return raw ? (JSON.parse(raw) as Marks) : {};
  } catch {
    return {};
  }
}

/**
 * Write the whole set back, dropping the oldest marks if the browser refuses.
 *
 * Insertion order is the age order — JS objects keep string keys in the order
 * they were added — so the first key is the oldest drawing.
 */
export function saveMarks(caseId: string, marks: Marks): Marks {
  if (typeof window === "undefined") return marks;
  const kept: Marks = { ...marks };
  for (let attempt = 0; attempt < 12; attempt++) {
    try {
      localStorage.setItem(KEY(caseId), JSON.stringify(kept));
      return kept;
    } catch {
      const keys = Object.keys(kept);
      // Nothing left to drop, or only the newest remains: give up quietly. The
      // marks are a nicety and the game is still perfectly playable without them.
      if (keys.length <= 1) {
        try {
          localStorage.removeItem(KEY(caseId));
        } catch {
          /* nothing more to try */
        }
        return {};
      }
      delete kept[keys[0]];
    }
  }
  return kept;
}

/** Throw away one photo's drawing and go back to the untouched original. */
export function clearMark(caseId: string, marks: Marks, photoId: string): Marks {
  if (!(photoId in marks)) return marks;
  const next = { ...marks };
  delete next[photoId];
  return saveMarks(caseId, next);
}

export function clearMarks(caseId: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY(caseId));
  } catch {
    /* nothing to do */
  }
}

/** The marked version if there is one, otherwise the photo as it came. */
export function shown(marks: Marks, photoId: string, src: string): string {
  return marks[photoId] ?? src;
}
