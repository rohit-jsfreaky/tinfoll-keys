"use client";

/**
 * The mute button.
 *
 * It sits outside the HUD because the HUD hides itself whenever an overlay is
 * open, and an overlay being open is exactly when Cal is talking. Somebody who
 * wants him to stop must be able to stop him mid-sentence.
 *
 * The choice is remembered, so a player who mutes once is not asked again.
 */

import { useEffect, useState } from "react";
import { isMuted, onMuteChange, setMuted } from "@/lib/vo";

export function Mute() {
  const [muted, setLocal] = useState(false);

  // Read on the client only — the server has no localStorage and would render
  // the wrong icon for a frame.
  useEffect(() => {
    setLocal(isMuted());
    return onMuteChange(setLocal);
  }, []);

  return (
    <button
      onClick={() => setMuted(!muted)}
      title={muted ? "Cal is muted" : "Mute Cal"}
      aria-label={muted ? "Unmute narration" : "Mute narration"}
      className="absolute bottom-5 left-6 z-40 rounded border border-[var(--electric)]/25 px-3 py-1.5 font-mono text-[10px] tracking-[0.25em] text-[var(--electric)]/70 transition hover:border-[var(--electric)]/60 hover:bg-[var(--electric)]/10"
    >
      {muted ? "CAL: MUTED" : "CAL: ON"}
    </button>
  );
}
