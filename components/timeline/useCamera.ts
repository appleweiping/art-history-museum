"use client";

import { useEffect, useMemo, useRef } from "react";
import { select } from "d3-selection";
import {
  zoom,
  zoomIdentity,
  zoomTransform,
  type D3ZoomEvent,
  type ZoomBehavior,
} from "d3-zoom";
import { interpolateZoom } from "d3-interpolate";
import gsap from "gsap";
import { K_MAX, K_MIN, LOD, WORLD_H, WORLD_W } from "@/lib/constants";
import { useTimelineStore, type CameraTransform } from "@/stores/timelineStore";

export interface CameraApi {
  flyToBounds(b: { x0: number; y0: number; x1: number; y1: number }): void;
  flyToPoint(x: number, y: number, k?: number): void;
  getTransform(): CameraTransform;
  stop(): void;
}

/**
 * Binds d3-zoom to the SVG (wheel/drag/pinch) and exposes GSAP-driven
 * fly-to animations that always route through zoom.transform so d3's
 * internal state never desyncs from what's on screen.
 */
export function useCamera(
  svgRef: React.RefObject<SVGSVGElement | null>,
  width: number,
  height: number,
): CameraApi {
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const tweenRef = useRef<gsap.core.Tween | null>(null);
  const sizeRef = useRef({ width, height });
  sizeRef.current = { width, height };

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || width === 0 || height === 0) return;

    const fitK = Math.min(width / (WORLD_W * 1.06), height / (WORLD_H * 1.06));
    const kMin = Math.min(K_MIN, fitK * 0.9);

    const behavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([kMin, K_MAX])
      .translateExtent([
        [-900, -400],
        [WORLD_W + 900, WORLD_H + 400],
      ])
      .on("start", (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
        // the user always wins over a fly-to tween
        if (event.sourceEvent) tweenRef.current?.kill();
      })
      .on("zoom", (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
        const t = event.transform;
        const state = useTimelineStore.getState();
        state.setTransform({ x: t.x, y: t.y, k: t.k });
        const band = t.k < LOD.starIn[0] ? 0 : t.k < 2 ? 1 : 2;
        if (band !== state.band) state.setBand(band);
      });

    zoomRef.current = behavior;
    const sel = select(svg);
    sel.call(behavior);
    sel.on("dblclick.zoom", null);

    // initial fit-all with 6% padding
    const t0 = zoomIdentity
      .translate(width / 2 - (WORLD_W / 2) * fitK, height / 2 - (WORLD_H / 2) * fitK)
      .scale(fitK);
    sel.call(behavior.transform, t0);

    return () => {
      tweenRef.current?.kill();
      sel.on(".zoom", null);
      zoomRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svgRef, width, height]);

  return useMemo<CameraApi>(() => {
    const flyToView = (target: [number, number, number]) => {
      const svg = svgRef.current;
      const behavior = zoomRef.current;
      const { width: vw, height: vh } = sizeRef.current;
      if (!svg || !behavior || vw === 0) return;
      const cur = zoomTransform(svg);
      const curView: [number, number, number] = [
        (vw / 2 - cur.x) / cur.k,
        (vh / 2 - cur.y) / cur.k,
        vw / cur.k,
      ];
      const interp = interpolateZoom(curView, target);
      const proxy = { t: 0 };
      tweenRef.current?.kill();
      tweenRef.current = gsap.to(proxy, {
        t: 1,
        duration: Math.min(2.4, Math.max(0.9, interp.duration / 1100)),
        ease: "power2.inOut",
        onUpdate: () => {
          const v = interp(proxy.t);
          const k = Math.min(K_MAX, vw / v[2]);
          const t = zoomIdentity
            .translate(vw / 2 - v[0] * k, vh / 2 - v[1] * k)
            .scale(k);
          select(svg).call(behavior.transform, t);
        },
      });
    };

    return {
      flyToBounds(b) {
        const { width: vw, height: vh } = sizeRef.current;
        const w = b.x1 - b.x0;
        const h = b.y1 - b.y0;
        const viewW = Math.max(w * 1.3, (h * 1.3 * vw) / Math.max(vh, 1), 400);
        flyToView([(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, viewW]);
      },
      flyToPoint(x, y, k = 6) {
        const { width: vw } = sizeRef.current;
        flyToView([x, y - 40 / k, vw / k]);
      },
      getTransform() {
        return useTimelineStore.getState().transform;
      },
      stop() {
        tweenRef.current?.kill();
      },
    };
  }, [svgRef]);
}
