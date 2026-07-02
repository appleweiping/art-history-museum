"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PointerLockControls } from "@react-three/drei";
import * as THREE from "three";
import type { GalleryLayout } from "@/lib/museum/layout";
import { EYE_HEIGHT } from "@/lib/museum/layout";
import { useMuseumStore } from "@/lib/museum/store";

const WALK_SPEED = 3.0;
const KEYS: Record<string, [number, number]> = {
  KeyW: [0, 1],
  ArrowUp: [0, 1],
  KeyS: [0, -1],
  ArrowDown: [0, -1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

/**
 * Pointer-lock + WASD with a hand-rolled per-axis clamp against the room
 * bounds (free wall sliding, no physics engine needed for one rectangle).
 * Also raycasts from screen center for painting hover/click while locked.
 */
export default function PlayerControls({ layout }: { layout: GalleryLayout }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null);
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  const pressed = useRef(new Set<string>());
  const velocity = useRef(new THREE.Vector3());
  const raycaster = useRef(new THREE.Raycaster());
  const lastRaycast = useRef(0);

  // spawn
  useEffect(() => {
    camera.position.set(...layout.spawn.position);
    camera.rotation.set(0, layout.spawn.yaw, 0);
  }, [camera, layout]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (KEYS[e.code]) pressed.current.add(e.code);
    };
    const up = (e: KeyboardEvent) => pressed.current.delete(e.code);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // click while locked → inspect hovered painting
  useEffect(() => {
    const onPointerDown = () => {
      const state = useMuseumStore.getState();
      if (!state.locked) return;
      if (state.hoveredId != null) {
        controlsRef.current?.unlock?.();
        state.setInspected(state.hoveredId);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  useFrame((state, dtRaw) => {
    const locked: boolean = controlsRef.current?.isLocked ?? false;
    if (!locked) return;
    const dt = Math.min(dtRaw, 1 / 30);

    // movement
    let fb = 0;
    let lr = 0;
    for (const code of pressed.current) {
      const [x, z] = KEYS[code];
      lr += x;
      fb += z;
    }
    const fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    fwd.y = 0;
    fwd.normalize();
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0));
    const move = new THREE.Vector3()
      .addScaledVector(fwd, fb)
      .addScaledVector(right, lr);
    if (move.lengthSq() > 0) move.normalize().multiplyScalar(WALK_SPEED);
    velocity.current.lerp(move, 1 - Math.exp(-12 * dt));
    camera.position.addScaledVector(velocity.current, dt);

    // per-axis clamp = free sliding along walls
    const b = layout.bounds;
    camera.position.x = Math.min(b.x1, Math.max(b.x0, camera.position.x));
    camera.position.z = Math.min(b.z1, Math.max(b.z0, camera.position.z));
    camera.position.y = EYE_HEIGHT;

    // center-screen hover raycast, throttled
    if (state.clock.elapsedTime - lastRaycast.current > 0.1) {
      lastRaycast.current = state.clock.elapsedTime;
      raycaster.current.setFromCamera(new THREE.Vector2(0, 0), camera);
      raycaster.current.far = 7;
      const hits = raycaster.current.intersectObjects(scene.children, true);
      let found: number | null = null;
      for (const hit of hits) {
        let obj: THREE.Object3D | null = hit.object;
        while (obj) {
          if (obj.userData.artworkId != null) {
            found = obj.userData.artworkId as number;
            break;
          }
          obj = obj.parent;
        }
        if (found != null) break;
        // walls block the ray
        if (hit.object.userData.blocksRay) break;
      }
      const store = useMuseumStore.getState();
      if (store.hoveredId !== found) store.setHovered(found);
    }
  });

  return (
    <PointerLockControls
      ref={controlsRef}
      makeDefault
      onLock={() => useMuseumStore.getState().setLocked(true)}
      onUnlock={() => {
        const store = useMuseumStore.getState();
        store.setLocked(false);
        store.setHovered(null);
      }}
    />
  );
}
