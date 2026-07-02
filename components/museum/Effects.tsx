"use client";

import {
  Bloom,
  EffectComposer,
  N8AO,
  ToneMapping,
  Vignette,
} from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";

/**
 * Minimal 60fps-safe chain. The composer renders to an HDR buffer, so ACES
 * tone mapping must be re-applied explicitly at the end (v3 defaults to AgX,
 * which would silently change the look).
 */
export default function Effects({ enabled = true }: { enabled?: boolean }) {
  if (!enabled) return null;
  return (
    <EffectComposer multisampling={4} stencilBuffer={false}>
      <N8AO halfRes aoRadius={0.4} intensity={2.5} distanceFalloff={0.8} quality="medium" />
      <Bloom mipmapBlur intensity={0.15} luminanceThreshold={1.0} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette eskil={false} offset={0.25} darkness={0.55} />
    </EffectComposer>
  );
}
