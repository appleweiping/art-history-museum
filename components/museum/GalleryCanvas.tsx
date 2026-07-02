"use client";

import { Suspense, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { AdaptiveDpr, PerformanceMonitor, Preload } from "@react-three/drei";
import type { MuseumData } from "@/lib/types";
import GalleryScene from "./GalleryScene";

interface Props {
  data: MuseumData;
  walkable: boolean;
}

export default function GalleryCanvas({ data, walkable }: Props) {
  const [quality, setQuality] = useState<"high" | "low">("high");
  const [dpr, setDpr] = useState<[number, number]>([1, 1.75]);

  return (
    <Canvas
      shadows="soft"
      dpr={dpr}
      gl={{
        antialias: false,
        powerPreference: "high-performance",
        stencil: false,
        toneMappingExposure: 1.1,
      }}
      camera={{ fov: 70, near: 0.1, far: 60, position: [0, 1.65, 4] }}
    >
      <PerformanceMonitor
        onDecline={() => {
          setQuality("low");
          setDpr([1, 1.25]);
        }}
        onIncline={() => setQuality("high")}
      >
        <Suspense fallback={null}>
          <GalleryScene data={data} walkable={walkable} quality={quality} />
          <Preload all />
        </Suspense>
      </PerformanceMonitor>
      <AdaptiveDpr pixelated />
    </Canvas>
  );
}
