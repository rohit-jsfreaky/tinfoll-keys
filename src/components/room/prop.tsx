"use client";

/**
 * Loads CC0 glTF models and puts them where you asked.
 *
 * Every model arrives with its own idea of where its origin is — some are
 * centred, some sit on the floor, some hang from a ceiling point. Rather than
 * hand-tuning an offset per model and re-checking screenshots, we measure the
 * real bounding box after load and anchor it: `bottom` sits it on the given y,
 * `top` hangs it from the given y. X and Z are always centred on the position.
 *
 * All models are CC0 from Poly Haven. See CREDITS.md.
 */

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useFBX, useGLTF } from "@react-three/drei";
import { HALF_D, HALF_W } from "./models";
import * as THREE from "three";

export type PropAnchor = "bottom" | "top" | "centre";
export type PropScale = number | [number, number, number];

interface Shaping {
  scale: PropScale;
  rotation: [number, number, number];
  anchor: PropAnchor;
  /** Real-world height in metres. Wins over `scale` when given. */
  fitHeight?: number;
  /** Real-world size of the LONGEST side, in metres. For flat things — a rug's
   * height is its pile thickness, so fitting by height makes it enormous. */
  fitLongest?: number;
}

/**
 * Scale, rotate, then anchor. Order matters: measuring before rotating would
 * anchor a model by the wrong face and leave it hovering or half buried.
 */
function shape(source: THREE.Object3D, { scale, rotation, anchor, fitHeight, fitLongest }: Shaping): { node: THREE.Object3D; size: THREE.Vector3 } {
  const copy = source.clone(true);

  // A part lifted out of a bigger model still carries its old place in that
  // model, so clear it before we position it ourselves.
  copy.position.set(0, 0, 0);
  copy.quaternion.identity();
  copy.scale.setScalar(1);
  copy.rotation.set(rotation[0], rotation[1], rotation[2]);
  copy.updateMatrixWorld(true);

  if (fitHeight || fitLongest) {
    // Downloaded models arrive at wildly different scales — the corkboard is
    // 3669 units tall, the soda cans 362. Stating a real-world size is the only
    // reliable way to place forty of them.
    const first = new THREE.Box3().setFromObject(copy);
    const size = new THREE.Vector3();
    first.getSize(size);
    const span = fitLongest ? Math.max(size.x, size.y, size.z) : size.y;
    const want = fitLongest ?? fitHeight ?? 1;
    copy.scale.setScalar(span > 1e-6 ? want / span : 1);
  } else if (Array.isArray(scale)) {
    copy.scale.set(scale[0], scale[1], scale[2]);
  } else {
    copy.scale.setScalar(scale);
  }
  copy.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(copy);
  const centre = new THREE.Vector3();
  box.getCenter(centre);

  copy.position.x -= centre.x;
  copy.position.z -= centre.z;
  if (anchor === "bottom") copy.position.y -= box.min.y;
  else if (anchor === "top") copy.position.y -= box.max.y;
  else copy.position.y -= centre.y;

  const size = new THREE.Vector3();
  box.getSize(size);
  return { node: copy, size };
}

export interface PropProps {
  url: string;
  position?: [number, number, number];
  /** Applied BEFORE anchoring, so a model laid on its side still sits flat. */
  rotation?: [number, number, number];
  /** One number, or [x, y, z] when a model needs stretching. */
  scale?: PropScale;
  anchor?: PropAnchor;
  /** Real-world height in metres. Simpler than guessing a scale factor. */
  fitHeight?: number;
  /** Real-world size of the longest side. Use for flat things like rugs. */
  fitLongest?: number;
  /**
   * Push the model's BACK flush against a wall instead of centring it on
   * `position`. Without this you have to know each model's depth by heart, and
   * a fridge ends up half inside the plaster with a bin in front of it.
   */
  wall?: "left" | "right" | "back";
  /** Gap from the wall in metres. */
  gap?: number;
  /** Radians per second. Only the ceiling fan uses this. */
  spinY?: number;
  /** Runs once on the loaded copy, for material fixes a model ships wrong. */
  tweak?: (root: THREE.Object3D) => void;
}

export function Prop({
  url,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  anchor = "bottom",
  fitHeight,
  fitLongest,
  wall,
  gap = 0.04,
  spinY = 0,
  tweak,
}: PropProps) {
  const { scene } = useGLTF(url);
  const spinner = useRef<THREE.Group>(null);
  const [rx, ry, rz] = rotation;
  const [sx, sy, sz] = Array.isArray(scale) ? scale : [scale, scale, scale];

  const { node, size } = useMemo(
    () => {
      const shaped = shape(scene, { scale, rotation, anchor, fitHeight, fitLongest });
      tweak?.(shaped.node);
      return shaped;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scene, sx, sy, sz, rx, ry, rz, anchor, fitHeight, fitLongest],
  );

  // shape() centres the model on x/z, so the back edge is half its depth away.
  const placed: [number, number, number] = [...position];
  if (wall === "left") placed[0] = -HALF_W + gap + size.x / 2;
  else if (wall === "right") placed[0] = HALF_W - gap - size.x / 2;
  else if (wall === "back") placed[2] = -HALF_D + gap + size.z / 2;

  useFrame((_, dt) => {
    if (spinY && spinner.current) spinner.current.rotation.y += dt * spinY;
  });

  return (
    <group position={placed}>
      <group ref={spinner}>
        <primitive object={node} />
      </group>
    </group>
  );
}

/**
 * One named piece out of a model that ships several.
 *
 * The wine bottle model is a row of four. We only want one or two, in our own
 * places, one of them knocked over — so we pull single nodes out by name rather
 * than dropping the whole row on the table.
 */
export function PropPart({
  url,
  part,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  anchor = "bottom",
}: PropProps & { part: string }) {
  const { scene } = useGLTF(url);
  const [rx, ry, rz] = rotation;
  const [sx, sy, sz] = Array.isArray(scale) ? scale : [scale, scale, scale];

  const node = useMemo(() => {
    const source = scene.getObjectByName(part);
    if (!source) {
      console.warn(`PropPart: no node named "${part}" in ${url}`);
      return null;
    }
    return shape(source, { scale, rotation, anchor }).node;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, part, url, sx, sy, sz, rx, ry, rz, anchor]);

  if (!node) return null;
  return (
    <group position={position}>
      <primitive object={node} />
    </group>
  );
}


/**
 * The same placing logic, for an FBX instead of a glTF.
 *
 * FBX exports carry no agreed unit — this one comes out of Blender at a scale
 * nobody can guess from the outside — so instead of a scale number you give it
 * the height you want in metres and it works the factor out from the real
 * bounding box.
 */
export function FbxProp({
  url,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  fitHeight,
  anchor = "bottom",
}: Omit<PropProps, "scale" | "spinY"> & { fitHeight: number }) {
  const source = useFBX(url);
  const [rx, ry, rz] = rotation;

  const node = useMemo(() => {
    const copy = source.clone(true);
    copy.position.set(0, 0, 0);
    copy.quaternion.identity();
    copy.scale.setScalar(1);
    copy.rotation.set(rx, ry, rz);
    copy.updateMatrixWorld(true);

    const first = new THREE.Box3().setFromObject(copy);
    const size = new THREE.Vector3();
    first.getSize(size);
    const factor = size.y > 0 ? fitHeight / size.y : 1;
    copy.scale.setScalar(factor);
    copy.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(copy);
    const centre = new THREE.Vector3();
    box.getCenter(centre);
    copy.position.x -= centre.x;
    copy.position.z -= centre.z;
    if (anchor === "bottom") copy.position.y -= box.min.y;
    else if (anchor === "top") copy.position.y -= box.max.y;
    else copy.position.y -= centre.y;

    return copy;
  }, [source, rx, ry, rz, fitHeight, anchor]);

  return (
    <group position={position}>
      <primitive object={node} />
    </group>
  );
}

/**
 * Deliberately NOT preloading everything here.
 *
 * A blanket preload at module scope fires all 41 downloads the instant the page
 * imports this file, which is what made the first few seconds stutter. The
 * scene mounts in tiers instead (see Boot / useLoadTiers) and Suspense pulls
 * each model in as its tier appears.
 */
export function preload(urls: readonly string[]) {
  urls.forEach((u) => useGLTF.preload(u));
}
