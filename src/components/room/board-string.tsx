"use client";

/**
 * Red string between pinned photos.
 *
 * Drawn as a curve that sags in the middle, never a straight line. ART.md is
 * blunt about this: the sag is the difference between "a corkboard" and "an
 * SVG diagram". Yarn has weight.
 *
 * Each string is a thin tube, so it catches the room light and reads as a real
 * thread from an angle rather than a flat stroke painted onto the cork.
 */

import { useMemo } from "react";
import * as THREE from "three";
import { pinPoint } from "./board-pins";
import { BOARD } from "./room-scene";

const RED = "#a3231d";
const RADIUS = 0.0045;

function String({ from, to }: { from: [number, number, number]; to: [number, number, number] }) {
  const geometry = useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const span = a.distanceTo(b);
    // The control point sits below the midpoint by an amount that grows with
    // the span, so a long string droops more than a short one — like real yarn.
    const mid = a.clone().add(b).multiplyScalar(0.5);
    mid.y -= 0.05 + span * 0.09;
    mid.z += 0.012;
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    return new THREE.TubeGeometry(curve, 24, RADIUS, 6, false);
  }, [from, to]);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color={RED} roughness={0.75} emissive={RED} emissiveIntensity={0.18} />
    </mesh>
  );
}

export interface BoardStringsProps {
  /** Photo ids on the board, in slot order. */
  pinned: string[];
  links: Array<[string, string]>;
}

export function BoardStrings({ pinned, links }: BoardStringsProps) {
  const strings = useMemo(
    () =>
      links
        .map(([a, b]) => {
          const sa = pinned.indexOf(a);
          const sb = pinned.indexOf(b);
          if (sa < 0 || sb < 0) return null;
          return { key: `${a}|${b}`, from: pinPoint(sa), to: pinPoint(sb) };
        })
        .filter((s): s is NonNullable<typeof s> => s !== null),
    [pinned, links],
  );

  return (
    <group position={[BOARD.x, BOARD.y, BOARD.z]}>
      {strings.map((s) => (
        <String key={s.key} from={s.from} to={s.to} />
      ))}
    </group>
  );
}
