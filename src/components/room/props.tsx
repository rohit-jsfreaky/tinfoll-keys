"use client";

/**
 * Everything in the room that is not the board itself.
 *
 * Laid out from the concept art in art-raw/concepts/. The lesson from those
 * paintings was that the room was not too dark or too pink — it was too EMPTY.
 * A GTA interior is a lived-in flat: a sofa, a rug, laundry, cables, shoes left
 * where they were kicked off. That clutter is most of the work here.
 *
 * Sizes are given as real-world heights in metres (`fitHeight`) rather than
 * scale factors, because forty downloaded models arrive at forty different
 * scales and nobody can guess them from the filename.
 */

import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { BOTTLE, PH, SK, WARDROBE_FBX } from "./models";
import { FbxProp, Prop, PropPart } from "./prop";

const PAPER = "#efe7d8";
const METAL = "#2b2f2c";

/** Heights of the surfaces things stand on. */
export const TV_STAND_TOP = 1.07;
const NIGHTSTAND_TOP = 0.7;
const COFFEE_TABLE_TOP = 0.42;

/* ------------------------------------------------------------------ */
/* lighting hardware                                                   */
/* ------------------------------------------------------------------ */

/**
 * A cheap LED strip in an aluminium channel along the top of a side wall.
 * Left runs cold, right runs pink — strip lights are never truly white, and it
 * puts the palette into the room at the top of frame.
 */
function WallStrip({ side, colour }: { side: -1 | 1; colour: string }) {
  const LEN = 4.6;
  return (
    <group position={[side * 3.45, 2.82, -0.7]}>
      <mesh position={[side * 0.028, 0.05, 0]}>
        <boxGeometry args={[0.07, 0.085, LEN]} />
        <meshStandardMaterial color={METAL} roughness={0.3} metalness={0.75} />
      </mesh>
      <mesh position={[side * -0.012, 0, 0]}>
        <boxGeometry args={[0.04, 0.05, LEN - 0.08]} />
        <meshBasicMaterial color={colour} toneMapped={false} />
      </mesh>
      {[-1.6, 0, 1.6].map((z) => (
        <pointLight
          key={z}
          position={[side * -0.25, -0.08, z]}
          intensity={11}
          distance={8}
          decay={1.7}
          color={colour}
        />
      ))}
    </group>
  );
}

export function WallStrips() {
  return (
    <>
      <WallStrip side={-1} colour="#d6f6ff" />
      <WallStrip side={1} colour="#ffd9e8" />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* walls                                                               */
/* ------------------------------------------------------------------ */

/**
 * Posters on the right wall. Original artwork made for this project in the
 * Leonida palette — the concept art independently put posters in the same
 * place, which was a good sign the instinct was right.
 */
function WallPosters() {
  const [leonida, driver, gellhorn] = useTexture([
    "/room/posters/poster-leonida.jpg",
    "/room/posters/poster-driver.jpg",
    "/room/posters/poster-gellhorn.jpg",
  ]);

  const wall = [
    { map: leonida, z: -2.9, y: 1.82, w: 0.66, tilt: 0.018 },
    { map: driver, z: -2.2, y: 1.66, w: 0.58, tilt: -0.03 },
    { map: gellhorn, z: 1.15, y: 1.88, w: 0.62, tilt: 0.012 },
  ];

  return (
    <group position={[3.47, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
      {wall.map((p, i) => (
        <group key={i} position={[p.z, p.y, 0]} rotation={[0, 0, p.tilt]}>
          <mesh position={[0, 0, -0.006]}>
            <planeGeometry args={[p.w + 0.03, p.w * 1.5 + 0.03]} />
            <meshStandardMaterial color="#16181c" roughness={0.5} metalness={0.4} />
          </mesh>
          <mesh>
            <planeGeometry args={[p.w, p.w * 1.5]} />
            <meshStandardMaterial map={p.map} roughness={0.72} />
          </mesh>
        </group>
      ))}
    </group>
  );
}


/**
 * What you see through the balcony door.
 *
 * Without this the glass is a black hole and the flat feels sealed in. The
 * concept art put a whole lit skyline out there, and it is most of why that
 * painting reads as a city apartment rather than a bunker.
 */
function OutsideView() {
  const view = useTexture("/room/window-view.jpg");
  return (
    <group position={[6.4, 0, -0.6]} rotation={[0, -Math.PI / 2, 0]}>
      <mesh position={[0, 2.0, 0]}>
        <planeGeometry args={[9, 5.6]} />
        <meshBasicMaterial map={view} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Paper taped straight to the plaster. He ran out of board. */
function WallPapers() {
  // Above the shelving, on the only clear strip of wall left.
  const sheets = [
    { y: 2.48, z: -1.75, w: 0.3, h: 0.4, r: 0.05 },
    { y: 2.32, z: -1.2, w: 0.26, h: 0.34, r: -0.08 },
    { y: 2.55, z: -0.62, w: 0.22, h: 0.3, r: 0.11 },
    { y: 2.3, z: -0.1, w: 0.28, h: 0.2, r: -0.04 },
  ];
  return (
    <group>
      {sheets.map((s, i) => (
        <mesh key={i} position={[-3.47, s.y, s.z]} rotation={[0, Math.PI / 2, s.r]}>
          <planeGeometry args={[s.w, s.h]} />
          <meshStandardMaterial color={PAPER} roughness={0.95} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* the room                                                            */
/* ------------------------------------------------------------------ */

export function RoomProps() {
  return (
    <>
      {/* ---------------- back wall: the working end ---------------- */}
      <Prop url={SK.tvStand} position={[0, 0, 0]} wall="back" fitLongest={2.1} />
      <Prop url={PH.box} position={[0.72, TV_STAND_TOP, -3.02]} rotation={[0, -0.35, 0]} />
      <Prop url={SK.camera} position={[0.2, TV_STAND_TOP, -3.02]} rotation={[0, 0.5, 0]} fitLongest={0.15} />
      <Prop url={SK.mug} position={[-0.3, TV_STAND_TOP, -2.98]} />
      <Prop url={PH.deskLamp} position={[0.95, TV_STAND_TOP, -3.05]} rotation={[0, -0.7, 0]} />
      <PropPart url={PH.bottles} part={BOTTLE.bordeaux} position={[-0.62, TV_STAND_TOP, -3.04]} rotation={[0, 0.6, 0]} />
      <PropPart
        url={PH.bottles}
        part={BOTTLE.burgundy}
        position={[-0.9, TV_STAND_TOP, -2.98]}
        rotation={[Math.PI / 2, 0, 0.5]}
      />
      {/* <Prop url={SK.plantTall} position={[-2.75, 0, 0]} wall="back" fitHeight={1.5} /> */}
      
      {/* ---------------- left wall, back to front ----------------
        * Each piece sits flush to the wall with a real gap between it and the
        * next, the way you would actually push furniture around a room. */}
      <FbxProp url={WARDROBE_FBX} position={[-3.05, 0, -2.55]} rotation={[0, Math.PI / 2, 0]} fitHeight={2.15} />
      <Prop url={SK.wireShelf} position={[0, 0, -0.95]} wall="left" />
      <Prop url={PH.crate} position={[-3.12, 1.44, -1.15]} />
      <Prop url={PH.crateWood} position={[-3.12, 0.95, -0.98]} rotation={[0, 0.3, 0]} />




      <Prop url={SK.fridge} position={[0, 0, 0.2]} rotation={[0, 6.31, 0]} wall="left" fitHeight={1.72} />
      <Prop url={SK.desk} position={[0, 0, 2.15]} rotation={[0, Math.PI / 2, 0]} wall="left" fitHeight={0.76} />
      <Prop url={SK.laptop} position={[-2.95, 0.76, 2.15]} rotation={[0, 25, 0]} fitLongest={0.35} />
      <Prop url={SK.officeChair} position={[-3, 0, 3]} rotation={[0, -3.5, 0]} />
      <Prop url={SK.bin} position={[-3.15, 0, 1.35]} fitHeight={0.55} />
      <Prop url={SK.laundryBasket} position={[-2, 0, -3.2]} rotation={[0, 0.1, 0]} fitLongest={0.6} />

      <Prop url={SK.slidingDoor} position={[0, 0, -0.6]} rotation={[0, -Math.PI / 2, 0]} wall="right" fitHeight={2.5} />
      <Prop url={SK.railing} position={[4.4, 0, -0.6]} rotation={[-Math.PI / 2, 0, -Math.PI / 2]} fitLongest={3.0} />
      <Prop url={PH.balconyChair} position={[4.05, 0, 0.5]} rotation={[0, -1.1, 0]} />


      <Prop url={PH.nightstand} position={[0, 0, -2.75]} rotation={[0, -Math.PI / 2, 0]} wall="right" />

      <Prop url={PH.scanner} position={[3.12, NIGHTSTAND_TOP, -2.75]} rotation={[0, -1.2, 0]} />
      <PropPart url={PH.bottles} part={BOTTLE.alsace} position={[3.12, NIGHTSTAND_TOP, -2.5]} rotation={[0, -0.4, 0]} />


      <Prop url={SK.plantSmall} position={[3.2, 0, -1.9]} />
      <Prop url={SK.skateboard} position={[2.8, 0, -3.2]} rotation={[0, 1.5, 0]} />

      <Prop url={SK.rug} position={[1.45, 0.006, 0.5]} rotation={[0, 0.06, 0]} fitLongest={3.0} />
      <Prop url={SK.sofa} position={[2.05, 0, 0.55]} rotation={[0, -Math.PI / 2, 0]} />
      <Prop url={SK.blanket} position={[2.15, 0.5, 0.95]} rotation={[0, -1.2, 0]} fitLongest={1.0} />

      <Prop url={SK.coffeeTable} position={[1.02, 0.01, 0.6]} rotation={[0, 0, 0]} />
      
      <Prop url={SK.books} position={[1.05, COFFEE_TABLE_TOP, 0.62]} rotation={[0, 0.3, 0]} fitLongest={0.42} />
      <Prop url={SK.ashtray} position={[1.08, COFFEE_TABLE_TOP, 0.25]} fitLongest={0.16} />
      <Prop url={SK.sodaCans} position={[1.02, COFFEE_TABLE_TOP, 0.32]} rotation={[0, 0.2, 0]} fitLongest={0.3} />
      <Prop url={SK.pizzaBox} position={[0.9, COFFEE_TABLE_TOP, 1]} rotation={[-Math.PI / 2, 0, 0.5]} fitLongest={0.4} />


      <Prop url={PH.fan} position={[0.2, 3.08, -1.1]} anchor="top" spinY={2.6} /> 

      <OutsideView />
      <WallStrips />
      <WallPosters />
      <WallPapers />
    </>
  );
}
