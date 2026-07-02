"use client";

import type { LightPlacement } from "@/lib/museum/layout";
import { WALL_HEIGHT } from "@/lib/museum/layout";

/**
 * Track bar + can light at each spotlight origin — honest geometry for the
 * light pools and the only thing bright enough to bloom.
 */
export default function CeilingFixture({ light }: { light: LightPlacement }) {
  const [x, , z] = light.position;
  const dx = light.target[0] - x;
  const dz = light.target[2] - z;
  const yaw = Math.atan2(dx, dz);
  const pitch = Math.atan2(Math.hypot(dx, dz), WALL_HEIGHT - 0.15 - light.target[1]);

  return (
    <group position={[x, WALL_HEIGHT - 0.02, z]}>
      {/* track stem */}
      <mesh position={[0, -0.05, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.1, 8]} />
        <meshStandardMaterial color="#111111" roughness={0.5} metalness={0.6} />
      </mesh>
      {/* can, tilted toward the painting */}
      <group position={[0, -0.13, 0]} rotation-y={yaw} rotation-x={pitch - Math.PI / 2}>
        <mesh castShadow={false}>
          <cylinderGeometry args={[0.05, 0.062, 0.16, 16]} />
          <meshStandardMaterial color="#111111" roughness={0.45} metalness={0.7} />
        </mesh>
        {/* glowing lens — feeds the Bloom pass */}
        <mesh position={[0, -0.085, 0]} rotation-x={Math.PI / 2}>
          <circleGeometry args={[0.045, 16]} />
          <meshStandardMaterial
            color="#fff8e7"
            emissive="#fff8e7"
            emissiveIntensity={5}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  );
}
