"use client";

import { useMemo } from "react";
import { MeshReflectorMaterial, useTexture } from "@react-three/drei";
import * as THREE from "three";
import type { GalleryLayout } from "@/lib/museum/layout";

/** Polished herringbone parquet with blurry, roughness-modulated reflections. */
export default function ReflectiveFloor({
  layout,
  resolution = 1024,
}: {
  layout: GalleryLayout;
  resolution?: number;
}) {
  const { width: W, length: L } = layout;
  const [diff, arm, nor] = useTexture([
    "/textures/herringbone_parquet_diff_2k.jpg",
    "/textures/herringbone_parquet_arm_2k.jpg",
    "/textures/herringbone_parquet_nor_gl_2k.jpg",
  ]);

  const maps = useMemo(() => {
    const rx = W / 2.4;
    const ry = L / 2.4;
    const d = diff.clone();
    const a = arm.clone();
    const n = nor.clone();
    for (const t of [d, a, n]) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(rx, ry);
      t.anisotropy = 8;
    }
    d.colorSpace = THREE.SRGBColorSpace;
    return { d, a, n };
  }, [diff, arm, nor, W, L]);

  return (
    <mesh rotation-x={-Math.PI / 2} receiveShadow userData={{ blocksRay: true }}>
      <planeGeometry args={[W, L]} />
      <MeshReflectorMaterial
        resolution={resolution}
        blur={[400, 100]}
        mixBlur={1}
        mixStrength={2.2}
        mirror={0}
        depthScale={1.2}
        minDepthThreshold={0.4}
        maxDepthThreshold={1.4}
        map={maps.d}
        aoMap={maps.a}
        roughnessMap={maps.a}
        metalnessMap={maps.a}
        normalMap={maps.n}
        normalScale={new THREE.Vector2(0.55, 0.55)}
        color="#b8a88e"
        envMapIntensity={0.4}
      />
    </mesh>
  );
}
