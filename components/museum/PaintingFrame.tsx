"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import type { PaintingPlacement, LightPlacement } from "@/lib/museum/layout";
import { useMuseumStore } from "@/lib/museum/store";

const FRAME_BORDER = 0.09;
const FRAME_DEPTH = 0.06;

function FrameGeometry({ width, height }: { width: number; height: number }) {
  const geometry = useMemo(() => {
    const outerW = width + FRAME_BORDER * 2;
    const outerH = height + FRAME_BORDER * 2;
    const shape = new THREE.Shape();
    shape.moveTo(-outerW / 2, -outerH / 2);
    shape.lineTo(outerW / 2, -outerH / 2);
    shape.lineTo(outerW / 2, outerH / 2);
    shape.lineTo(-outerW / 2, outerH / 2);
    shape.closePath();
    const hole = new THREE.Path();
    hole.moveTo(-width / 2, -height / 2);
    hole.lineTo(width / 2, -height / 2);
    hole.lineTo(width / 2, height / 2);
    hole.lineTo(-width / 2, height / 2);
    hole.closePath();
    shape.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: FRAME_DEPTH,
      bevelEnabled: true,
      bevelThickness: 0.015,
      bevelSize: 0.012,
      bevelSegments: 2,
    });
    return geo;
  }, [width, height]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <primitive object={geometry} attach="geometry" />;
}

function PaintingImage({
  url,
  width,
  height,
}: {
  url: string;
  width: number;
  height: number;
}) {
  const texture = useLoader(THREE.TextureLoader, url);
  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    texture.needsUpdate = true;
  }, [texture]);
  return (
    <mesh position={[0, 0, FRAME_DEPTH - 0.035]}>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial
        map={texture}
        roughness={0.88}
        metalness={0}
        envMapIntensity={0.25}
      />
    </mesh>
  );
}

function LinenPlaceholder({ width, height }: { width: number; height: number }) {
  return (
    <mesh position={[0, 0, FRAME_DEPTH - 0.035]}>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial color="#d9d2c0" roughness={0.95} metalness={0} />
    </mesh>
  );
}

/**
 * A hung painting: gilt/walnut extruded frame whose bevel catches the glare,
 * canvas recessed behind the frame face, its own shadow-casting spotlight,
 * and hover feedback (light warms up when the reticle rests on it).
 */
export default function PaintingFrame({
  placement,
  light,
  gilt,
}: {
  placement: PaintingPlacement;
  light: LightPlacement;
  gilt: boolean;
}) {
  const { artwork, position, rotationY, width, height } = placement;
  const spotRef = useRef<THREE.SpotLight>(null);
  const target = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(...light.target);
    return o;
  }, [light.target]);

  // hover → spotlight warms up
  useFrame(() => {
    const spot = spotRef.current;
    if (!spot) return;
    const hovered = useMuseumStore.getState().hoveredId === artwork.id;
    const goal = hovered ? 44 : 30;
    spot.intensity += (goal - spot.intensity) * 0.12;
  });

  const frameColor = gilt ? "#8a6d3b" : "#3a2d1c";

  return (
    <group>
      <group
        position={position}
        rotation-y={rotationY}
        userData={{ artworkId: artwork.id }}
        onClick={(e) => {
          // unlocked (mobile/QA) tap-to-inspect; locked clicks go through
          // the center-reticle raycast in PlayerControls instead
          e.stopPropagation();
          const store = useMuseumStore.getState();
          if (!store.locked) store.setInspected(artwork.id);
        }}
      >
        <mesh castShadow receiveShadow>
          <FrameGeometry width={width} height={height} />
          <meshPhysicalMaterial
            color={frameColor}
            roughness={0.32}
            metalness={gilt ? 0.85 : 0.15}
            clearcoat={0.5}
            clearcoatRoughness={0.25}
            envMapIntensity={1.3}
          />
        </mesh>
        {/* inner shadow lip around the canvas */}
        <mesh position={[0, 0, FRAME_DEPTH - 0.045]}>
          <planeGeometry args={[width + 0.02, height + 0.02]} />
          <meshStandardMaterial color="#141210" roughness={1} />
        </mesh>
        <Suspense fallback={<LinenPlaceholder width={width} height={height} />}>
          <PaintingImage url={artwork.imageTextureUrl} width={width} height={height} />
        </Suspense>
      </group>

      <spotLight
        ref={spotRef}
        position={light.position}
        angle={0.5}
        penumbra={0.65}
        decay={2}
        distance={9}
        intensity={30}
        color="#fff3e0"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0002}
        shadow-normalBias={0.03}
        target={target}
      />
      <primitive object={target} />
    </group>
  );
}
