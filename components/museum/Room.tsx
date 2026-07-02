"use client";

import { useMemo } from "react";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import type { GalleryLayout } from "@/lib/museum/layout";
import { WALL_HEIGHT } from "@/lib/museum/layout";

const WALL_T = 0.3;

function configure(t: THREE.Texture, rx: number, ry: number, srgb = false) {
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Walls, ceiling, baseboard, crown molding and a decorative entrance door. */
export default function Room({ layout }: { layout: GalleryLayout }) {
  const { width: W, length: L } = layout;

  const [wallDiff, wallArm, wallNor] = useTexture([
    "/textures/painted_plaster_wall_diff_1k.jpg",
    "/textures/painted_plaster_wall_arm_1k.jpg",
    "/textures/painted_plaster_wall_nor_gl_1k.jpg",
  ]);

  const wallMaterial = useMemo(() => {
    const diff = configure(wallDiff.clone(), 4, 1.6, true);
    const arm = configure(wallArm.clone(), 4, 1.6);
    const nor = configure(wallNor.clone(), 4, 1.6);
    return new THREE.MeshStandardMaterial({
      map: diff,
      aoMap: arm,
      roughnessMap: arm,
      metalnessMap: arm,
      normalMap: nor,
      normalScale: new THREE.Vector2(0.35, 0.35),
      color: new THREE.Color("#e8e4dc"),
    });
  }, [wallDiff, wallArm, wallNor]);

  const trimMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#33291d",
        roughness: 0.45,
        metalness: 0.05,
      }),
    [],
  );

  const walls: Array<{
    pos: [number, number, number];
    size: [number, number, number];
  }> = [
    { pos: [0, WALL_HEIGHT / 2, -L / 2 - WALL_T / 2], size: [W + WALL_T * 2, WALL_HEIGHT, WALL_T] },
    { pos: [0, WALL_HEIGHT / 2, L / 2 + WALL_T / 2], size: [W + WALL_T * 2, WALL_HEIGHT, WALL_T] },
    { pos: [W / 2 + WALL_T / 2, WALL_HEIGHT / 2, 0], size: [WALL_T, WALL_HEIGHT, L] },
    { pos: [-W / 2 - WALL_T / 2, WALL_HEIGHT / 2, 0], size: [WALL_T, WALL_HEIGHT, L] },
  ];

  // baseboard + crown segments hugging the inner wall faces
  const trims: Array<{
    pos: [number, number, number];
    size: [number, number, number];
  }> = [];
  for (const y of [0.05, WALL_HEIGHT - 0.04]) {
    const h = y < 1 ? 0.1 : 0.08;
    trims.push(
      { pos: [0, y, -L / 2 + 0.015], size: [W, h, 0.03] },
      { pos: [0, y, L / 2 - 0.015], size: [W, h, 0.03] },
      { pos: [W / 2 - 0.015, y, 0], size: [0.03, h, L] },
      { pos: [-W / 2 + 0.015, y, 0], size: [0.03, h, L] },
    );
  }

  return (
    <group>
      {walls.map((w, i) => (
        <mesh
          key={`wall-${i}`}
          position={w.pos}
          material={wallMaterial}
          receiveShadow
          castShadow
          userData={{ blocksRay: true }}
        >
          <boxGeometry args={w.size} />
        </mesh>
      ))}
      {trims.map((t, i) => (
        <mesh key={`trim-${i}`} position={t.pos} material={trimMaterial} receiveShadow>
          <boxGeometry args={t.size} />
        </mesh>
      ))}

      {/* ceiling */}
      <mesh position={[0, WALL_HEIGHT, 0]} rotation-x={Math.PI / 2}>
        <planeGeometry args={[W + 0.6, L + 0.6]} />
        <meshStandardMaterial color="#f4f2ee" roughness={0.95} metalness={0} />
      </mesh>

      {/* decorative entrance door on the south wall */}
      <group position={[0, 0, L / 2 - 0.02]}>
        <mesh position={[0, 1.25, 0]} material={trimMaterial}>
          <boxGeometry args={[1.9, 2.5, 0.06]} />
        </mesh>
        <mesh position={[0, 2.56, 0]} material={trimMaterial}>
          <boxGeometry args={[2.14, 0.12, 0.1]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 1.01, 1.28, 0]} material={trimMaterial}>
            <boxGeometry args={[0.12, 2.56, 0.1]} />
          </mesh>
        ))}
        {/* brass door handles */}
        {[-1, 1].map((s) => (
          <mesh key={`h${s}`} position={[s * 0.16, 1.15, -0.06]}>
            <sphereGeometry args={[0.035, 16, 12]} />
            <meshStandardMaterial color="#c9a96a" roughness={0.25} metalness={0.9} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
