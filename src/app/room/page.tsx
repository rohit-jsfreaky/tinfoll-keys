"use client";

/**
 * The room. Phase 3.
 *
 * The 3D room is the place; the flat layers on top of it (the box, the case
 * file, the endings) are the interactions. All game progress lives in one
 * GameState from lib/game.ts and is saved to localStorage on every change, so
 * a judge who closes the tab and comes back picks up where they left off.
 */

import { Suspense, useCallback, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { AdaptiveDpr } from "@react-three/drei";
import * as THREE from "three";
import { InteractionProvider, useLooking } from "@/components/room/interaction";
import { LookRig } from "@/components/room/look-rig";
import { RoomScene } from "@/components/room/room-scene";
import { Boot, useLoadTiers } from "@/components/game/boot";
import { CaseReader } from "@/components/game/case-reader";
import { Ending } from "@/components/game/ending";
import { Evidence } from "@/components/game/evidence";
import { HowToPlay, useHowToPlay } from "@/components/game/how-to-play";
import { Hud } from "@/components/game/hud";
import { Accusation } from "@/components/game/accusation";
import { Briefing } from "@/components/game/briefing";
import { PhotoPreview } from "@/components/game/photo-preview";
import { Mute } from "@/components/game/mute";
import type { CaseFile } from "@/lib/case";
import { clearMark, clearMarks, loadMarks, saveMarks, shown, type Marks } from "@/lib/marks";
import { stop as stopVo, voAccuseLead, voIntro, voNotYet, voShort, warm } from "@/lib/vo";
import {
  clearGame,
  findClues,
  link,
  loadGame,
  newGame,
  pin,
  saveGame,
  accuse,
  canAccuse,
  useHint,
  missingRequired,
  nextInChain,
  type GameState,
  type LinkOutcome,
} from "@/lib/game";

const CASE_ID = "01";

export default function RoomPage() {
  const [locked, setLocked] = useState(false);
  const onLockChange = useCallback((v: boolean) => setLocked(v), []);
  const { looking, onLookingChange } = useLooking();

  const [file, setFile] = useState<CaseFile | null>(null);
  const [game, setGame] = useState<GameState>(() => newGame(CASE_ID));
  const [boxOpen, setBoxOpen] = useState(false);
  const [caseOpen, setCaseOpen] = useState(false);
  /** The photo string has been picked up from. Click a second photo to tie it. */
  const [held, setHeld] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  /** Photos the player has drawn on, kept between sessions. */
  const [marks, setMarks] = useState<Marks>({});
  /** A pinned photo being looked at close up, from a right click on the board. */
  const [preview, setPreview] = useState<string | null>(null);
  const [accuseOpen, setAccuseOpen] = useState(false);
  /**
   * Story before rules. This opens on every load rather than once, because it
   * is the only thing that tells a player who they are, and somebody arriving
   * cold should never have to go looking for that.
   */
  const [briefOpen, setBriefOpen] = useState(true);
  const { tier, done: loaded } = useLoadTiers();
  const howTo = useHowToPlay();

  /**
   * True once the saved game has been read back.
   *
   * This flag is load-bearing. The save effect below runs on every change to
   * `game`, including the very first render — so without it the empty starting
   * state was written over the real save before the async read ever happened,
   * and every reload wiped the player's progress. The marks survived only
   * because they are written on demand rather than by an effect, which is what
   * made the bug look like half the game was restoring and half was not.
   */
  const [hydrated, setHydrated] = useState(false);

  // The case, then whatever was saved for it.
  useEffect(() => {
    fetch(`/cases/${CASE_ID}/case.json`)
      .then((r) => r.json())
      .then((f: CaseFile) => {
        setFile(f);
        const saved = loadGame(CASE_ID);
        /*
         * Progress and drawings live in two separate keys, and they must never
         * be allowed to disagree. If there is no progress — a first visit, or a
         * save lost to an older build — then any drawings left behind are
         * orphans: the photo shows a red circle and the game insists you have
         * never marked it, which reads as broken and is impossible to recover
         * from inside the game. So the orphans go.
         */
        if (saved && saved.found.length) {
          setGame(saved);
          setMarks(loadMarks(CASE_ID));
        } else {
          clearMarks(CASE_ID);
          setMarks({});
        }
      })
      .catch(() => setFile(null))
      .finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated) return; // never write before the read
    saveGame(game);
  }, [game, hydrated]);

  /*
   * Start Cal talking the moment the player takes hold of the mouse.
   *
   * That click is the gesture browsers require before anything can make noise,
   * and it is the first thing everybody does. The how-to card also fires this,
   * but it only shows on a player's first ever visit — so on every load after
   * that this is the only thing that starts him.
   */
  useEffect(() => {
    if (!locked || !loaded) return;
    voIntro();
    warm();
  }, [locked, loaded]);

  const openCase = useCallback(() => setCaseOpen(true), []);
  const openBox = useCallback(() => setBoxOpen(true), []);
  const onFound = useCallback((ids: string[]) => setGame((g) => findClues(g, ids)), []);
  const onPin = useCallback(
    (photoId: string) => setGame((g) => (file ? pin(g, file, photoId) : g)),
    [file],
  );

  /**
   * Keep the drawing. saveMarks hands back what actually fitted in storage —
   * it drops the oldest marks rather than failing — so the state follows what
   * was really written, not what we hoped to write.
   */
  const onMark = useCallback((photoId: string, dataUrl: string) => {
    setMarks((m) => saveMarks(CASE_ID, { ...m, [photoId]: dataUrl }));
  }, []);

  const onClearMark = useCallback((photoId: string) => {
    setMarks((m) => clearMark(CASE_ID, m, photoId));
  }, []);

  const onInspect = useCallback((photoId: string) => setPreview(photoId), []);

  const onUseHint = useCallback((hotspotId: string) => setGame((g) => useHint(g, hotspotId)), []);

  const say = useCallback((msg: string) => {
    setToast(null);
    // next frame, so the same message twice still re-animates
    requestAnimationFrame(() => setToast(msg));
  }, []);

  const ready = !!file && canAccuse(file, game.found);

  const openAccusation = useCallback(() => {
    if (!file) return;
    if (!canAccuse(file, game.found)) {
      // Cal will not name anybody until you know who the man in the photos is.
      // Say where to go, not just no — a wall that will not explain itself is
      // indistinguishable from a bug, and the first player to hit it thought
      // he had finished the game.
      const left = missingRequired(file, game.found);
      say(`${left} MORE TO FIND  ·  OPEN THE BOX, IT'S ON TOP`);
      voNotYet();
      return;
    }
    setAccuseOpen(true);
    voAccuseLead();
  }, [file, game.found, say]);

  const onAccuse = useCallback(
    (picks: Record<string, string>) => {
      if (!file) return;
      const result = accuse(game, file, picks);
      if (result.outcome === "incomplete") return;
      setGame(result.state);
      if (result.outcome === "short") voShort();
      if (result.outcome === "cracked" || result.outcome === "wasted") setAccuseOpen(false);
    },
    [file, game],
  );

  /** The photo the game wants looked at next, once the yard is proved dirty. */
  const nextPhoto = file ? nextInChain(file, game.found) : null;
  /** How many of the clues Cal insists on are still missing. */
  const left = file ? missingRequired(file, game.found) : 0;


  /**
   * Look at a photo, click: string is picked up. Look at another, click: tied.
   * With the mouse captured there is nothing to drag with, so it is two clicks.
   */
  const onPick = useCallback(
    (photoId: string) => {
      if (!file) return;
      if (held === null) {
        setHeld(photoId);
        return;
      }
      if (held === photoId) {
        setHeld(null);
        say("STRING PUT BACK");
        return;
      }
      const result = link(game, file, held, photoId);
      setGame(result.state);
      setHeld(null);
      // The board is a scratchpad. Nothing here is right or wrong, so nothing
      // here gets marked — the only judged moment in the game is the accusation.
      const words: Record<LinkOutcome, string> = {
        same: "",
        "not-pinned": "",
        over: "",
        already: "ALREADY TIED",
        tied: "TIED",
      };
      if (words[result.outcome]) say(words[result.outcome]);
    },
    [file, game, held, say],
  );

  const restart = useCallback(() => {
    stopVo();
    clearGame(CASE_ID);
    clearMarks(CASE_ID);
    setGame(newGame(CASE_ID));
    setMarks({});
    setPreview(null);
    setAccuseOpen(false);
    setHeld(null);
    setToast(null);
  }, []);

  const over = game.phase !== "playing";
  const overlayOpen =
    boxOpen || caseOpen || over || howTo.open || !loaded || preview !== null || accuseOpen ||
    (briefOpen && !!file);
  // Enter states the accusation, so it can be reached without handing the mouse
  // back first. Escape is already taken — the browser uses it to release the
  // pointer and we do not get to override that.
  useEffect(() => {
    if (!loaded || overlayOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      openAccusation();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [loaded, overlayOpen, openAccusation]);

  return (
    <main
      className={
        "relative h-screen w-screen overflow-hidden bg-[var(--night-deep)] [&_canvas]:transition-[filter] [&_canvas]:duration-[2500ms] " +
        (game.phase === "wasted" ? "[&_canvas]:grayscale" : "")
      }
    >
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 1.6, -0.45], fov: 60, near: 0.05, far: 40 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.02;
        }}
      >
        <Suspense fallback={null}>
          <InteractionProvider onLookingChange={onLookingChange} enabled={locked && !overlayOpen}>
            <RoomScene
              onOpenCase={openCase}
              onOpenBox={openBox}
              file={file}
              pinned={game.pinned}
              found={game.found}
              links={game.links}
              held={held}
              onPick={onPick}
              marks={marks}
              onInspect={onInspect}
              tier={tier}
            />
          </InteractionProvider>
        </Suspense>
        <LookRig onLockChange={onLockChange} frozen={overlayOpen} />
        {/* Drops resolution when the frame rate dips, restores it when it recovers. */}
        <AdaptiveDpr pixelated />
      </Canvas>

      {/* Darkened corners. Cheap, and it does more for the mood than any light. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 52%, rgba(0,0,0,0) 52%, rgba(10,13,26,0.36) 88%, rgba(10,13,26,0.62) 100%)",
        }}
      />

      {/* What you point with. Dimmed until the mouse is actually captured. */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div
          className={`rounded-full bg-[var(--paper)] shadow-[0_0_6px_rgba(0,0,0,0.9)] transition-all duration-200 ${
            !locked ? "h-1 w-1 opacity-25" : looking ? "h-3 w-3 opacity-100" : "h-1.5 w-1.5 opacity-80"
          }`}
        />
      </div>

      {/* What you are looking at. */}
      {locked && !overlayOpen && looking && (
        <p className="pointer-events-none absolute left-1/2 top-[calc(50%+22px)] -translate-x-1/2 font-mono text-xs tracking-widest text-[var(--neon-cyan)] drop-shadow-[0_1px_4px_rgba(0,0,0,0.95)]">
          {looking.label}
        </p>
      )}

      <Hud
        stars={game.stars}
        toast={toast}
        title={file?.title ?? ""}
        left={left}
        visible={!overlayOpen && locked}
      />

      {/* Reopen the instructions at any time. */}
      {loaded && !overlayOpen && (
        <div className="absolute bottom-5 right-6 flex gap-2">
          <button
            onClick={() => setBriefOpen(true)}
            className="rounded border border-[var(--sodium)]/30 px-3 py-1.5 font-mono text-[10px] tracking-[0.25em] text-[var(--sodium)]/75 transition hover:border-[var(--sodium)]/70 hover:bg-[var(--sodium)]/10"
          >
            THE STORY
          </button>
          <button
            onClick={howTo.show}
            className="rounded border border-[var(--electric)]/25 px-3 py-1.5 font-mono text-[10px] tracking-[0.25em] text-[var(--electric)]/70 transition hover:border-[var(--electric)]/60 hover:bg-[var(--electric)]/10"
          >
            HOW TO PLAY
          </button>
        </div>
      )}

      {/*
        * The only way to finish, and it must NOT depend on pointer lock.
        *
        * It used to render only while the mouse was captured — but a locked
        * pointer has no cursor, so you had to press Escape to click it, and
        * releasing the mouse made it disappear. Catch-22. It stays on screen
        * either way now, and Enter opens it without releasing anything.
        */}
      {loaded && !overlayOpen && (
        <button
          onClick={openAccusation}
          className={`absolute bottom-16 left-1/2 -translate-x-1/2 select-none rounded px-6 py-2.5 font-mono text-xs font-bold tracking-[0.3em] transition ${
            ready
              ? "bg-[var(--neon-pink)] text-[#1a0a14] shadow-[0_0_30px_rgba(255,47,158,0.5)] hover:brightness-110"
              : "border border-[var(--paper)]/18 text-[var(--paper)]/40 hover:border-[var(--paper)]/35"
          }`}
        >
          {ready ? "NAME THEM  ⏎" : `${left} MORE TO FIND`}
        </button>
      )}

      {loaded && <Mute />}

      {/* Briefing first, then the rules card. Who am I, then what do I press. */}
      {briefOpen && loaded && file && (
        <Briefing file={file} onClose={() => setBriefOpen(false)} />
      )}

      {howTo.open && loaded && !briefOpen && <HowToPlay onClose={howTo.close} />}

      <Boot tier={tier} done={loaded} />

      {caseOpen && file && <CaseReader file={file} onClose={() => setCaseOpen(false)} />}

      {over && file && <Ending file={file} game={game} onRestart={restart} />}

      {boxOpen && file && (
        <Evidence
          file={file}
          found={game.found}
          pinned={game.pinned}
          marks={marks}
          next={nextPhoto}
          hintsUsed={game.hintsUsed}
          hintsSeen={game.hintsSeen}
          onUseHint={onUseHint}
          onFound={onFound}
          onPin={onPin}
          onMark={onMark}
          onClearMark={onClearMark}
          onClose={() => setBoxOpen(false)}
        />
      )}

      {accuseOpen && file && (
        <Accusation
          file={file}
          stars={game.stars}
          lastWrong={game.lastWrong}
          onSubmit={onAccuse}
          onClose={() => setAccuseOpen(false)}
        />
      )}

      {preview && file && (() => {
        const photo = file.photos.find((p) => p.id === preview);
        if (!photo) return null;
        return (
          <PhotoPreview
            photo={photo}
            src={shown(marks, photo.id, photo.src)}
            clues={photo.hotspots
              .filter((h) => game.found.includes(h.id))
              .map((h) => h.clue ?? h.id)}
            onClose={() => setPreview(null)}
          />
        );
      })()}

      <p className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 font-mono text-xs tracking-widest text-[var(--electric)]/60">
        {overlayOpen ? "" : locked ? "ESC TO RELEASE THE MOUSE" : "CLICK TO LOOK AROUND"}
      </p>
    </main>
  );
}
