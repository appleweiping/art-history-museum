"use client";

import { OrbitControls } from "@react-three/drei";
import type { GalleryLayout } from "@/lib/museum/layout";
import { EYE_HEIGHT } from "@/lib/museum/layout";

/**
 * Touch / QA fallback: stand at the spawn point and look around; paintings
 * are inspected by tapping them (R3F pointer events handle the raycast).
 */
export default function OrbitFallbackControls({ layout }: { layout: GalleryLayout }) {
  const [sx, , sz] = layout.spawn.position;
  return (
    <OrbitControls
      makeDefault
      target={[sx, EYE_HEIGHT, sz - 4]}
      enablePan={false}
      enableZoom={true}
      minDistance={0.5}
      maxDistance={Math.max(layout.length * 0.7, 8)}
      maxPolarAngle={Math.PI * 0.55}
      minPolarAngle={Math.PI * 0.3}
    />
  );
}
