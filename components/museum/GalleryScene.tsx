"use client";

import { useMemo } from "react";
import { BakeShadows, Environment } from "@react-three/drei";
import type { MuseumData } from "@/lib/types";
import { computeGalleryLayout } from "@/lib/museum/layout";
import Room from "./Room";
import ReflectiveFloor from "./ReflectiveFloor";
import PaintingFrame from "./PaintingFrame";
import CeilingFixture from "./CeilingFixture";
import PlayerControls from "./PlayerControls";
import OrbitFallbackControls from "./OrbitFallbackControls";
import Effects from "./Effects";

interface Props {
  data: MuseumData;
  /** qa/mobile mode: no pointer lock, click paintings directly */
  walkable: boolean;
  quality: "high" | "low";
}

export default function GalleryScene({ data, walkable, quality }: Props) {
  const layout = useMemo(() => computeGalleryLayout(data.artworks), [data.artworks]);
  // pre-1800 works get gilt frames, moderns get walnut
  const gilt = (data.artist.birthYear ?? 1900) < 1800;

  return (
    <>
      <color attach="background" args={["#0b0a08"]} />
      <Environment files="/hdri/museum_of_ethnography_1k.hdr" environmentIntensity={0.3} />
      <ambientLight intensity={0.12} />

      <Room layout={layout} />
      <ReflectiveFloor layout={layout} resolution={quality === "high" ? 1024 : 512} />

      {layout.paintings.map((placement, i) => (
        <group key={placement.artwork.id}>
          <PaintingFrame
            placement={placement}
            light={layout.lights[i]}
            gilt={gilt}
            // shadow maps eat fragment texture units (MAX_TEXTURE_IMAGE_UNITS
            // is 16 on many GPUs) — cap shadow-casting lights at 6
            castShadow={i < 6}
          />
          <CeilingFixture light={layout.lights[i]} />
        </group>
      ))}

      {walkable ? (
        <PlayerControls layout={layout} />
      ) : (
        <OrbitFallbackControls layout={layout} />
      )}

      <Effects enabled={quality === "high"} />
      {/* the scene is static — render every shadow map once, then freeze */}
      <BakeShadows />
    </>
  );
}
