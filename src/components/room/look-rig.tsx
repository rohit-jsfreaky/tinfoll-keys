"use client";

/**
 * The camera rig. You stand in one place and turn your head — that is all.
 *
 * Deliberately NOT pointer lock. Pointer lock puts a "click to play" wall in
 * front of the first five seconds, and a judge with 90 seconds should not have
 * to get past a wall. Here the room starts moving the moment the mouse moves.
 *
 * On a touch screen there is no cursor, so you drag to look instead.
 */

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";

/**
 * Free look. The full width of the screen maps to a full turn, so moving the
 * mouse to either edge puts the wall behind you in front of you — you can see
 * every corner of the room without ever clicking.
 */
const MAX_YAW = Math.PI;
const MAX_PITCH = 1.15;

/** Seconds for the camera to catch up. Small = snappy, large = floaty. */
const FOLLOW = 0.09;

/** Radians per pixel when dragging on a touch screen. */
const DRAG_SPEED = 0.0035;

export function LookRig({ frozen = false }: { frozen?: boolean }) {
  const camera = useThree((s) => s.camera);
  const target = useRef({ yaw: 0, pitch: 0 });
  const current = useRef({ yaw: 0, pitch: 0 });
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const frozenRef = useRef(frozen);
  frozenRef.current = frozen;

  useEffect(() => {
    const clamp = (v: number, max: number) => (v < -max ? -max : v > max ? max : v);

    const onPointerMove = (e: PointerEvent) => {
      if (frozenRef.current) return;

      if (e.pointerType === "mouse") {
        // Absolute: where the mouse sits on screen is where you are looking.
        const nx = (e.clientX / window.innerWidth) * 2 - 1;
        const ny = (e.clientY / window.innerHeight) * 2 - 1;
        target.current.yaw = -nx * MAX_YAW;
        target.current.pitch = -ny * MAX_PITCH;
        return;
      }

      // Touch or pen: only turn while a finger is down, by how far it moved.
      const d = drag.current;
      if (!d || d.id !== e.pointerId) return;
      target.current.yaw = clamp(target.current.yaw - (e.clientX - d.x) * DRAG_SPEED, MAX_YAW);
      target.current.pitch = clamp(target.current.pitch - (e.clientY - d.y) * DRAG_SPEED, MAX_PITCH);
      d.x = e.clientX;
      d.y = e.clientY;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    };
    const onPointerUp = () => {
      drag.current = null;
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    window.addEventListener("pointercancel", onPointerUp, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, []);

  useFrame((state, dt) => {
    // Frame-rate independent smoothing, so it feels the same at 30fps and 144.
    const k = 1 - Math.exp(-Math.min(dt, 0.1) / FOLLOW);
    current.current.yaw += (target.current.yaw - current.current.yaw) * k;
    current.current.pitch += (target.current.pitch - current.current.pitch) * k;

    // A tiny amount of drift, so the room never feels locked to a tripod.
    // Nobody notices this consciously. Everybody feels it.
    const t = state.clock.elapsedTime;
    const swayY = Math.sin(t * 0.31) * 0.006 + Math.sin(t * 0.13) * 0.004;
    const swayX = Math.sin(t * 0.24 + 1.7) * 0.004;

    camera.rotation.order = "YXZ";
    camera.rotation.y = current.current.yaw + swayY;
    camera.rotation.x = current.current.pitch + swayX;
    camera.rotation.z = 0;
  });

  return null;
}
