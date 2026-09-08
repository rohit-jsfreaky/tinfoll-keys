"use client";

/**
 * Cal's room. One corner of it, anyway — you never move, so only what you can
 * see from the chair exists.
 *
 * The look, straight out of ART.md: a dark warm room at 3am with cold neon
 * OUTSIDE the window, behind the board. Everyone else in this challenge is
 * neon-on-black. Ours is dim and physical, and the neon is somewhere else.
 *
 * Units are metres. The floor is y=0. You are sitting at z=-0.5 facing the
 * back wall at z=-3.
 */

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { RoomProps } from "./props";
import * as THREE from "three";

/* Palette from ART.md. */
const ROOM_DARK = "#171310";
/* Deliberately cooler and darker than the cork. If the wall is warm too, the
 * board vanishes into it and stops reading as an object you can walk up to. */
const WALL = "#282430";
const FLOOR = "#2b2422";
const WOOD = "#2a1d14";
const PAPER = "#efe7d8";

const ROOM_W = 7;
const ROOM_H = 3.1;
const ROOM_D = 7;

/** The board, and everything pinned to it, lives on the back wall. */
export const BOARD = {
  x: 0,
  y: 1.95,
  z: -3.44,
  w: 2.6,
  h: 1.7,
};


/** The view out: neon and palms, thrown out of focus. Unlit so it glows. */
function Window() {
  const view = useTexture("/room/window-view.jpg");
  return (
    <group position={[2.05, 1.95, -2.95]}>
      <mesh position={[0, 0, 0.004]}>
        <planeGeometry args={[1.45, 1.75]} />
        <meshBasicMaterial map={view} toneMapped={false} />
      </mesh>
      {/* frame */}
      <mesh position={[0, 0, 0.002]}>
        <planeGeometry args={[1.58, 1.88]} />
        <meshStandardMaterial color="#15110d" roughness={0.9} />
      </mesh>
      {/* one glazing bar, so it reads as a window and not a screen */}
      <mesh position={[0, 0, 0.008]}>
        <boxGeometry args={[0.028, 1.75, 0.02]} />
        <meshStandardMaterial color="#15110d" roughness={0.9} />
      </mesh>
    </group>
  );
}

function Corkboard() {
  const cork = useTexture("/room/cork.jpg");
  const mapped = useMemo(() => {
    const t = cork.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    // Few repeats on purpose. Tile it too often and the granules shrink below
    // what you can see from the chair, and the board goes flat brown.
    t.repeat.set(1.9, 1.25);
    t.needsUpdate = true;
    return t;
  }, [cork]);

  return (
    <group position={[BOARD.x, BOARD.y, BOARD.z]}>
      {/* A thin dark metal edge, not a heavy wooden surround — this is a board
       * somebody bought this year. It must sit BEHIND the cork: a box centred on
       * the board plane puts its front face in front of the cork and you end up
       * staring at a sheet of wood wondering where your corkboard went. */}
      <mesh position={[0, 0, -0.035]}>
        <boxGeometry args={[BOARD.w + 0.07, BOARD.h + 0.07, 0.06]} />
        <meshStandardMaterial color="#15171b" roughness={0.32} metalness={0.75} />
      </mesh>
      <mesh>
        <planeGeometry args={[BOARD.w, BOARD.h]} />
        <meshStandardMaterial map={mapped} roughness={0.98} />
      </mesh>
    </group>
  );
}

/**
 * The case file, pinned to the top left. This is the thing you click first.
 * It is only a shape for now — opening it comes next.
 */
function CaseFilePaper() {
  return (
    <group position={[BOARD.x - 0.92, BOARD.y + 0.47, BOARD.z + 0.012]} rotation={[0, 0, -0.045]}>
      <mesh>
        <planeGeometry args={[0.4, 0.53]} />
        <meshStandardMaterial color={PAPER} roughness={0.9} />
      </mesh>
      {/* a pin holding it up */}
      <mesh position={[0, 0.23, 0.012]}>
        <sphereGeometry args={[0.014, 10, 10]} />
        <meshStandardMaterial color="#a3231d" roughness={0.35} metalness={0.1} />
      </mesh>
    </group>
  );
}



function Shell() {
  return (
    <group>
      {/* back wall — the one you are looking at */}
      <mesh position={[0, ROOM_H / 2, -ROOM_D / 2]}>
        <planeGeometry args={[ROOM_W, ROOM_H]} />
        <meshStandardMaterial color={WALL} roughness={1} />
      </mesh>
      {/* left and right */}
      <mesh position={[-ROOM_W / 2, ROOM_H / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[ROOM_D, ROOM_H]} />
        <meshStandardMaterial color={WALL} roughness={1} />
      </mesh>
      <mesh position={[ROOM_W / 2, ROOM_H / 2, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[ROOM_D, ROOM_H]} />
        <meshStandardMaterial color={WALL} roughness={1} />
      </mesh>
      {/* floor and ceiling */}
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[ROOM_W, ROOM_D]} />
        <meshStandardMaterial color={FLOOR} roughness={1} />
      </mesh>
      <mesh position={[0, ROOM_H, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[ROOM_W, ROOM_D]} />
        <meshStandardMaterial color={ROOM_DARK} roughness={1} />
      </mesh>
    </group>
  );
}

/**
 * The clip lamp over the board.
 *
 * A spotlight, not a bare bulb. A bare bulb lights the whole back wall evenly
 * and the board disappears into it. A spot drops a pool of light on the cork
 * and leaves the wall in the dark, which is what makes the board the thing you
 * look at when the room loads.
 */
function BoardLamp() {
  const light = useRef<THREE.SpotLight>(null);
  const target = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(BOARD.x, BOARD.y, BOARD.z);
    return o;
  }, []);

  useFrame(() => {
    if (light.current && light.current.target !== target) light.current.target = target;
  });

  return (
    <group>
      <primitive object={target} />
      <spotLight
        ref={light}
        position={[0, 2.66, -1.4]}
        angle={0.88}
        penumbra={0.5}
        intensity={20}
        distance={7}
        decay={2}
        color="#ffdcb4"
      />
      {/* A slim LED bar on the ceiling, angled at the board. The old cone
        * pendant read as a spinning top hanging in mid air, and now that the
        * walls have visible strips, matching them is the consistent choice. */}
      <group position={[0, 2.94, -2.3]}>
        <mesh position={[0, 0.035, 0]}>
          <boxGeometry args={[2.5, 0.07, 0.1]} />
          <meshStandardMaterial color="#2c3036" roughness={0.3} metalness={0.75} />
        </mesh>
        <mesh position={[0, -0.012, -0.012]} rotation={[0.55, 0, 0]}>
          <boxGeometry args={[2.42, 0.04, 0.055]} />
          <meshBasicMaterial color="#fff1dc" toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

export function RoomScene() {
  return (
    <>
      {/* Horror lights a room with one warm bulb and lets the rest go black.
        * Leonida at 3am is humid and full of colour, so the fill is a cold
        * magenta and the shadows keep some life in them. */}
      <ambientLight intensity={0.42} color="#9d80c0" />
      <hemisphereLight args={["#ff6ea8", "#2a8f9c", 0.8]} />

      <BoardLamp />

      {/* desk lamp, off to the left */}
      <pointLight position={[-1.35, 0.95, -2.05]} intensity={2.6} distance={2.8} decay={2} color="#ffb457" />
      {/* The neon is not a detail in the window, it is a light source that
        * reaches across the whole room. This is the difference between "dark
        * room" and "Vice City at 3am". */}
      <pointLight position={[2.3, 2.0, -2.5]} intensity={26} distance={9} decay={1.8} color="#ff3d7f" />
      <pointLight position={[1.6, 1.5, -2.3]} intensity={12} distance={7} decay={1.8} color="#2ee6c1" />
      {/* a second sign somewhere off to the left, out of shot */}
      <pointLight position={[-2.6, 2.2, -0.6]} intensity={14} distance={8} decay={1.8} color="#2ee6c1" />

      <Shell />
      <Corkboard />
      <CaseFilePaper />
      <RoomProps />
    </>
  );
}
