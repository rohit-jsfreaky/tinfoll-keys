"use client";

/**
 * The camera rig. You stand in one place and turn your head — that is all.
 *
 * The mouse is captured (pointer lock), so the OS cursor disappears and the only
 * thing on screen is our own crosshair. Escape hands the mouse back; the browser
 * does that itself and we only have to notice.
 *
 * Yaw is unlimited so you can turn the whole way round. Pitch is fenced in,
 * because nobody needs to look through their own feet.
 *
 * A touch screen has no cursor and no pointer lock, so there you drag to look.
 */

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";

/** How far you can look up and down, in radians. About 66 degrees. */
const MAX_PITCH = 1.15;

/** Radians per pixel of mouse movement. */
const SENSITIVITY = 0.0022;

/** Radians per pixel when dragging on a touch screen. */
const DRAG_SPEED = 0.004;

/** Seconds for the camera to catch up. Small = snappy, large = floaty. */
const FOLLOW = 0.055;

export interface LookRigProps {
  /** Called whenever the mouse is captured or released. */
  onLockChange?: (locked: boolean) => void;
  /** Freeze the camera and release the mouse, for when a window is open. */
  frozen?: boolean;
}

export function LookRig({ onLockChange, frozen = false }: LookRigProps) {
  const camera = useThree((s) => s.camera);
  const canvas = useThree((s) => s.gl.domElement);

  const target = useRef({ yaw: 0, pitch: 0 });
  const current = useRef({ yaw: 0, pitch: 0 });
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const frozenRef = useRef(frozen);
  frozenRef.current = frozen;

  useEffect(() => {
    const clamp = (v: number, max: number) => (v < -max ? -max : v > max ? max : v);
    const isLocked = () => document.pointerLockElement === canvas;

    // Clicking the room captures the mouse.
    const onClick = () => {
      if (!isLocked() && !frozenRef.current) void canvas.requestPointerLock();
    };
    const onLockStateChange = () => onLockChange?.(isLocked());

    const onMouseMove = (e: MouseEvent) => {
      if (!isLocked() || frozenRef.current) return;
      // Free spin left and right; only up and down is fenced in.
      target.current.yaw -= e.movementX * SENSITIVITY;
      target.current.pitch = clamp(target.current.pitch - e.movementY * SENSITIVITY, MAX_PITCH);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    };
    const onPointerMove = (e: PointerEvent) => {
      if (frozenRef.current || e.pointerType === "mouse") return;
      const d = drag.current;
      if (!d || d.id !== e.pointerId) return;
      target.current.yaw -= (e.clientX - d.x) * DRAG_SPEED;
      target.current.pitch = clamp(target.current.pitch - (e.clientY - d.y) * DRAG_SPEED, MAX_PITCH);
      d.x = e.clientX;
      d.y = e.clientY;
    };
    const onPointerUp = () => {
      drag.current = null;
    };

    canvas.addEventListener("click", onClick);
    document.addEventListener("pointerlockchange", onLockStateChange);
    document.addEventListener("mousemove", onMouseMove);
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    window.addEventListener("pointercancel", onPointerUp, { passive: true });

    return () => {
      canvas.removeEventListener("click", onClick);
      document.removeEventListener("pointerlockchange", onLockStateChange);
      document.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [canvas, onLockChange]);

  // Hand the mouse back whenever a window opens over the room.
  useEffect(() => {
    if (frozen && document.pointerLockElement === canvas) document.exitPointerLock();
  }, [frozen, canvas]);

  useFrame((state, dt) => {
    // Frame-rate independent smoothing, so it feels the same at 30fps and 144.
    const k = 1 - Math.exp(-Math.min(dt, 0.1) / FOLLOW);
    current.current.yaw += (target.current.yaw - current.current.yaw) * k;
    current.current.pitch += (target.current.pitch - current.current.pitch) * k;

    // A tiny amount of drift, so the room never feels bolted to a tripod.
    // Nobody notices this consciously. Everybody feels it.
    const t = state.clock.elapsedTime;
    const swayY = Math.sin(t * 0.31) * 0.005 + Math.sin(t * 0.13) * 0.003;
    const swayX = Math.sin(t * 0.24 + 1.7) * 0.003;

    camera.rotation.order = "YXZ";
    camera.rotation.y = current.current.yaw + swayY;
    camera.rotation.x = current.current.pitch + swayX;
    camera.rotation.z = 0;
  });

  return null;
}
