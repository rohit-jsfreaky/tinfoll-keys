"use client";

/**
 * Photos and clue cards pinned to the corkboard.
 *
 * The concept art made one thing obvious: an empty board is what made the room
 * look unfinished. A board covered in photos, cards and string is the whole
 * image of this game — and it fills up as you play, which means the thing that
 * makes the room look right IS the thing you are doing.
 *
 * Clue text is drawn onto a canvas and used as a texture rather than pulled in
 * with a 3D text library. That keeps the handwriting ours, needs no font
 * downloaded from anywhere, and a card is a flat piece of paper anyway.
 */

import { Suspense, useMemo } from "react";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import type { CaseFile, CasePhoto } from "@/lib/case";
import { shown, type Marks } from "@/lib/marks";
import { Interactive } from "./interaction";
import { BOARD } from "./room-scene";

/* A slot is one photo with room for its clue card underneath. */
const COL_X = [-1.0, -0.5, 0, 0.5, 1.0];
const ROW_Y = [0.47, 0.0, -0.47];

/**
 * Slots fill from the middle outward, not from the top-left corner.
 *
 * A board fills up in whatever order the person pins things, but the FIRST
 * photo has to land where you are already looking — dropping it in a far corner
 * makes it look like nothing happened.
 */
const SLOTS: Array<[number, number]> = (() => {
  const out: Array<[number, number]> = [];
  for (const row of [1, 0, 2]) for (const col of [2, 1, 3, 0, 4]) out.push([col, row]);
  return out;
})();
export const PHOTO_W = 0.44;
export const PHOTO_H = 0.33;

/** Board-local position of the pushpin holding slot `n`. String ties on here. */
export function pinPoint(slot: number): [number, number, number] {
  const [colIndex, rowIndex] = SLOTS[slot % SLOTS.length];
  return [COL_X[colIndex], ROW_Y[rowIndex] + 0.05 + PHOTO_H / 2 + 0.022, 0.03];
}
const CARD_W = 0.42;
const CARD_H = 0.135;

const PAPER = "#efe7d8";
const INK = "#1a1714";

/** Deterministic wobble, so a photo lands crooked but always the same crooked. */
function tilt(seed: number) {
  const n = Math.sin(seed * 12.9898) * 43758.5453;
  return ((n - Math.floor(n)) - 0.5) * 0.09;
}

/**
 * A clue card, drawn as a texture.
 *
 * Wrapping is done by hand because canvas has no text wrapping, and the card is
 * a fixed size — a clue that runs long has to break onto another line rather
 * than run off the edge.
 */
function useCardTexture(text: string) {
  return useMemo(() => {
    const W = 620;
    const H = 200;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, W, H);

    // a faint ruled line, like a real index card
    ctx.strokeStyle = "rgba(163,35,29,0.18)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(28, 44);
    ctx.lineTo(W - 28, 44);
    ctx.stroke();

    ctx.fillStyle = INK;
    ctx.font = "italic 34px Georgia, 'Times New Roman', serif";
    ctx.textBaseline = "top";

    const words = text.split(" ");
    const lines: string[] = [];
    let line = "";
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (ctx.measureText(next).width > W - 60 && line) {
        lines.push(line);
        line = w;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);

    lines.slice(0, 4).forEach((l, i) => ctx.fillText(l, 30, 62 + i * 40));

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }, [text]);
}

function ClueCard({ text, position }: { text: string; position: [number, number, number] }) {
  const map = useCardTexture(text);
  if (!map) return null;
  return (
    <group position={position} rotation={[0, 0, tilt(text.length) * 0.8]}>
      <mesh>
        <planeGeometry args={[CARD_W, CARD_H]} />
        <meshStandardMaterial map={map} roughness={0.92} />
      </mesh>
      <mesh position={[0, CARD_H / 2 - 0.012, 0.006]}>
        <sphereGeometry args={[0.009, 8, 8]} />
        <meshStandardMaterial color="#c9a227" roughness={0.3} metalness={0.4} />
      </mesh>
    </group>
  );
}

function PinnedPhoto({
  photo,
  src,
  slot,
  clues,
  held,
  holding,
  onPick,
  onInspect,
}: {
  photo: CasePhoto;
  /** What actually goes on the wall: the player's marked copy if they made one. */
  src: string;
  slot: number;
  clues: string[];
  /** This photo is the one with string picked up from it. */
  held: boolean;
  /** Some photo is held, so clicking this one ties the string. */
  holding: boolean;
  onPick: () => void;
  onInspect: () => void;
}) {
  const map = useTexture(src);
  const [colIndex, rowIndex] = SLOTS[slot % SLOTS.length];
  const col = COL_X[colIndex];
  const row = ROW_Y[rowIndex];
  const wobble = tilt(slot + 1);
  const label =
    (held ? "PUT THE STRING BACK" : holding ? "TIE STRING HERE" : "PICK UP STRING") +
    "   ·   RIGHT CLICK TO LOOK";

  return (
    <Interactive id={`pin:${photo.id}`} label={label} onSelect={onPick} onInspect={onInspect}>
    <group position={[col, row + 0.05, 0.014]} rotation={[0, 0, wobble]}>
      {/* paper backing, so it reads as a print and not a floating image */}
      <mesh position={[0, -0.012, -0.002]}>
        <planeGeometry args={[PHOTO_W + 0.035, PHOTO_H + 0.075]} />
        <meshStandardMaterial color={PAPER} roughness={0.95} />
      </mesh>
      <mesh>
        <planeGeometry args={[PHOTO_W, PHOTO_H]} />
        <meshStandardMaterial map={map} roughness={0.85} />
      </mesh>

      {/* pushpin, sitting a little proud of the paper. Glows while string is on it. */}
      <mesh position={[0, PHOTO_H / 2 + 0.022, 0.012]} scale={held ? 1.6 : 1}>
        <sphereGeometry args={[0.013, 10, 10]} />
        <meshStandardMaterial
          color="#a3231d"
          roughness={0.3}
          metalness={0.15}
          emissive="#a3231d"
          emissiveIntensity={held ? 1.4 : 0}
        />
      </mesh>

      {clues.map((c, i) => (
        <ClueCard key={c} text={c} position={[0, -PHOTO_H / 2 - 0.105 - i * 0.15, 0.004]} />
      ))}
    </group>
    </Interactive>
  );
}

export interface BoardPinsProps {
  file: CaseFile;
  /** Photo ids the player has pinned up, in the order they pinned them. */
  pinned: string[];
  /** Hotspot ids already unlocked. */
  found: string[];
  /** The photo string has been picked up from, if any. */
  held: string | null;
  /** The player's drawn-on copies, keyed by photo id. */
  marks: Marks;
  onPick: (photoId: string) => void;
  onInspect: (photoId: string) => void;
}

export function BoardPins({ file, pinned, found, held, marks, onPick, onInspect }: BoardPinsProps) {
  const photos = useMemo(
    () =>
      pinned
        .map((id) => file.photos.find((p) => p.id === id))
        .filter((p): p is CasePhoto => !!p),
    [file, pinned],
  );

  return (
    <group position={[BOARD.x, BOARD.y, BOARD.z]}>
      {photos.map((photo, slot) => (
        // Each pin loads its own texture, so a new photo appearing never blanks
        // the whole room while it waits.
        // Keyed on the source as well as the id, so pinning a photo and then
        // drawing on it swaps the texture instead of keeping the old one.
        <Suspense key={`${photo.id}:${shown(marks, photo.id, photo.src)}`} fallback={null}>
          <PinnedPhoto
            photo={photo}
            src={shown(marks, photo.id, photo.src)}
            slot={slot}
            clues={photo.hotspots.filter((h) => found.includes(h.id)).map((h) => h.clue ?? h.id)}
            held={held === photo.id}
            holding={held !== null}
            onPick={() => onPick(photo.id)}
            onInspect={() => onInspect(photo.id)}
          />
        </Suspense>
      ))}
    </group>
  );
}
