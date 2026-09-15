"use client";

/**
 * Looking at things, and clicking them.
 *
 * With the mouse captured there is no cursor to point with, so the crosshair in
 * the middle of the screen IS the pointer. Every frame we cast one ray straight
 * out of the camera and see what it lands on. Whatever is nearest is "what you
 * are looking at", and a click acts on that.
 *
 * This is also why connecting two photos later will be look-click-look-click
 * rather than a drag: with a locked mouse there is nothing to drag WITH.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

export interface Target {
  id: string;
  /** Shown next to the crosshair when you look at it. */
  label: string;
  object: THREE.Object3D;
  onSelect: () => void;
  /** Right click. Optional — most things in the room have nothing to show. */
  onInspect?: () => void;
  /** World-space bounds, refreshed now and then. What the ray actually tests. */
  box: THREE.Box3;
}

interface Registry {
  add: (t: Target) => void;
  remove: (id: string) => void;
}

const RegistryContext = createContext<Registry | null>(null);

/** What the crosshair is currently on, for the UI outside the canvas. */
export interface Looking {
  id: string;
  label: string;
}

export function InteractionProvider({
  children,
  onLookingChange,
  enabled = true,
}: {
  children: ReactNode;
  onLookingChange?: (looking: Looking | null) => void;
  enabled?: boolean;
}) {
  const targets = useRef(new Map<string, Target>());

  const registry = useMemo<Registry>(
    () => ({
      add: (t) => targets.current.set(t.id, t),
      remove: (id) => targets.current.delete(id),
    }),
    [],
  );

  return (
    <RegistryContext.Provider value={registry}>
      <Picker targets={targets} onLookingChange={onLookingChange} enabled={enabled} />
      {children}
    </RegistryContext.Provider>
  );
}

/**
 * One ray, straight down the middle, every frame.
 *
 * Ray casting the whole scene would also hit walls and clutter, so we only test
 * the handful of things that registered themselves as interactive. That keeps
 * it cheap and stops a plant stealing a click meant for the box behind it.
 */
function Picker({
  targets,
  onLookingChange,
  enabled,
}: {
  targets: React.RefObject<Map<string, Target>>;
  onLookingChange?: (looking: Looking | null) => void;
  enabled: boolean;
}) {
  const camera = useThree((s) => s.camera);
  const canvas = useThree((s) => s.gl.domElement);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const centre = useMemo(() => new THREE.Vector2(0, 0), []);
  const hovered = useRef<Target | null>(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const frame = useRef(0);
  const hitPoint = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    if (!enabledRef.current) {
      if (hovered.current) {
        hovered.current = null;
        onLookingChange?.(null);
      }
      return;
    }

    raycaster.setFromCamera(centre, camera);
    const ray = raycaster.ray;
    frame.current++;

    // Bounds only need refreshing occasionally — nothing here moves fast, and
    // recomputing a 17k-triangle box every frame is exactly the cost we are
    // trying to avoid. Each target gets refreshed once every ~30 frames.
    let i = 0;
    let best: Target | null = null;
    let bestDistance = Infinity;
    for (const t of targets.current.values()) {
      if ((frame.current + i++) % 30 === 0 || t.box.isEmpty()) t.box.setFromObject(t.object);
      if (ray.intersectBox(t.box, hitPoint)) {
        const d = hitPoint.distanceTo(ray.origin);
        if (d < bestDistance) {
          bestDistance = d;
          best = t;
        }
      }
    }

    if (best?.id !== hovered.current?.id) {
      hovered.current = best;
      onLookingChange?.(best ? { id: best.id, label: best.label } : null);
    }
  });

  useEffect(() => {
    const onClick = () => {
      // Only act once the mouse is captured; the first click is what captures it.
      if (document.pointerLockElement !== canvas) return;
      if (!enabledRef.current) return;
      hovered.current?.onSelect();
    };
    /*
     * Right click is "look at this properly".
     *
     * Driven off mousedown rather than the contextmenu event: while the pointer
     * is locked the browser suppresses its own menu, and with it the contextmenu
     * event, so a handler hung on that never fires. mousedown still arrives at
     * the locked element with button 2.
     *
     * contextmenu is still hooked, purely to swallow the menu on the frames
     * where the mouse is not locked — otherwise a stray right click puts an OS
     * menu over the room.
     */
    const onRightDown = (e: MouseEvent) => {
      if (e.button !== 2) return;
      e.preventDefault();
      if (document.pointerLockElement !== canvas) return;
      if (!enabledRef.current) return;
      hovered.current?.onInspect?.();
    };
    const onContext = (e: MouseEvent) => e.preventDefault();

    canvas.addEventListener("click", onClick);
    canvas.addEventListener("mousedown", onRightDown);
    canvas.addEventListener("contextmenu", onContext);
    return () => {
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("mousedown", onRightDown);
      canvas.removeEventListener("contextmenu", onContext);
    };
  }, [canvas]);

  return null;
}

/**
 * Wrap anything in the room to make it clickable.
 *
 * The hit test is against the object's bounding box, not its triangles. That is
 * generous in exactly the way a crosshair wants to be, and it is what keeps the
 * per-frame cost flat no matter how detailed the model is.
 */
export function Interactive({
  id,
  label,
  onSelect,
  onInspect,
  children,
}: {
  id: string;
  label: string;
  onSelect: () => void;
  onInspect?: () => void;
  children: ReactNode;
}) {
  const registry = useContext(RegistryContext);
  const ref = useRef<THREE.Group>(null);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  const inspectRef = useRef(onInspect);
  inspectRef.current = onInspect;

  useEffect(() => {
    const object = ref.current;
    if (!registry || !object) return;
    registry.add({
      id,
      label,
      object,
      onSelect: () => selectRef.current(),
      onInspect: () => inspectRef.current?.(),
      box: new THREE.Box3(),
    });
    return () => registry.remove(id);
  }, [registry, id, label]);

  return <group ref={ref}>{children}</group>;
}

/** Convenience for the page: remembers what the crosshair is on. */
export function useLooking() {
  const [looking, setLooking] = useState<Looking | null>(null);
  const onLookingChange = useCallback((v: Looking | null) => setLooking(v), []);
  return { looking, onLookingChange };
}
