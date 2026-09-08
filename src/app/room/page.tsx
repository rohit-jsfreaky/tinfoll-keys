"use client";

/**
 * The room. Phase 3, step one: prove that standing in Cal's room and turning
 * your head feels like something. No photos, no game rules, no clues yet.
 *
 * If this does not feel right, we stop here and go back to the flat board —
 * the game rules are kept separate on purpose, so nothing is lost.
 */

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { LookRig } from "@/components/room/look-rig";
import { RoomScene } from "@/components/room/room-scene";

export default function RoomPage() {
  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#0d0b09]">
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: [0, 1.6, -0.45], fov: 60, near: 0.05, far: 40 }}
        gl={{ antialias: true }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.08;
        }}
      >
        <Suspense fallback={null}>
          <RoomScene />
        </Suspense>
        <LookRig />
      </Canvas>

      {/* Darkened corners. Cheap, and it does more for the mood than any light. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 52%, rgba(0,0,0,0) 52%, rgba(10,0,20,0.32) 88%, rgba(10,0,20,0.55) 100%)",
        }}
      />

      {/* What you point with. */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-1.5 w-1.5 rounded-full bg-[#efe7d8]/70 shadow-[0_0_6px_rgba(0,0,0,0.9)]" />
      </div>

      <p className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 font-mono text-xs tracking-widest text-[#efe7d8]/45">
        MOVE THE MOUSE TO LOOK AROUND
      </p>
    </main>
  );
}
