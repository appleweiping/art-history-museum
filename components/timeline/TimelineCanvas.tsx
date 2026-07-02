"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TimelinePeriod } from "@/lib/types";
import { assignLabelRows, layoutNebulae, layoutStars, periodBounds } from "@/lib/scales";
import { WORLD_H, WORLD_W } from "@/lib/constants";
import { useTimelineStore } from "@/stores/timelineStore";
import { useCamera } from "./useCamera";
import StarfieldBackground from "./StarfieldBackground";
import NebulaLayer from "./NebulaLayer";
import StarLayer from "./StarLayer";
import YearRuler from "./YearRuler";
import FilterDropdown from "./FilterDropdown";
import ArtistCard from "./ArtistCard";

declare global {
  interface Window {
    __timeline?: {
      ready: boolean;
      getTransform: () => { x: number; y: number; k: number };
      flyToArtist: (slug: string) => void;
      flyToPeriod: (slug: string) => void;
    };
  }
}

export default function TimelineCanvas({ periods }: { periods: TimelinePeriod[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const worldRef = useRef<SVGGElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const nebulae = useMemo(() => layoutNebulae(periods), [periods]);
  const stars = useMemo(() => layoutStars(periods), [periods]);
  const starBySlug = useMemo(
    () => new Map(stars.map((s) => [s.artist.slug, s])),
    [stars],
  );
  const labelRows = useMemo(() => {
    if (size.w === 0) return new Map<string, number>();
    const kFit = Math.min(size.w / (WORLD_W * 1.06), size.h / (WORLD_H * 1.06));
    return assignLabelRows(nebulae, kFit);
  }, [nebulae, size.w, size.h]);

  const camera = useCamera(svgRef, size.w, size.h);
  const selectedArtist = useTimelineStore((s) => s.selectedArtist);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // world layer follows the camera imperatively (no React re-render per tick)
  useEffect(() => {
    return useTimelineStore.subscribe(
      (s) => s.transform,
      (t) => {
        worldRef.current?.setAttribute(
          "transform",
          `translate(${t.x},${t.y}) scale(${t.k})`,
        );
      },
      { fireImmediately: true },
    );
  }, []);

  const flyToPeriod = useCallback(
    (slug: string) => {
      const nebula = nebulae.find((n) => n.period.slug === slug);
      if (!nebula) return;
      const store = useTimelineStore.getState();
      store.setSelectedArtist(null);
      store.setFocus({ kind: "period", slug });
      camera.flyToBounds(periodBounds(nebula, stars));
    },
    [nebulae, stars, camera],
  );

  const flyToArtist = useCallback(
    (slug: string) => {
      const star = starBySlug.get(slug);
      if (!star) return;
      const store = useTimelineStore.getState();
      store.setFocus({ kind: "artist", slug });
      camera.flyToPoint(star.x, star.y, 6);
      store.setSelectedArtist(slug);
    },
    [starBySlug, camera],
  );

  const onStarClick = useCallback((slug: string) => {
    const store = useTimelineStore.getState();
    store.setFocus({ kind: "artist", slug });
    store.setSelectedArtist(slug);
  }, []);

  // focus → shareable URL hash
  useEffect(() => {
    return useTimelineStore.subscribe(
      (s) => s.focus,
      (focus) => {
        const hash =
          focus == null
            ? ""
            : focus.kind === "period"
              ? `#${focus.slug}`
              : `#artist:${focus.slug}`;
        history.replaceState(null, "", hash || location.pathname);
      },
    );
  }, []);

  // ready flag + QA seam + deep-link hash
  useEffect(() => {
    if (size.w === 0) return;
    useTimelineStore.getState().setReady(true);
    window.__timeline = {
      ready: true,
      getTransform: camera.getTransform,
      flyToArtist,
      flyToPeriod,
    };
    const hash = decodeURIComponent(window.location.hash.slice(1));
    if (hash.startsWith("artist:")) {
      const t = setTimeout(() => flyToArtist(hash.slice(7)), 500);
      return () => clearTimeout(t);
    }
    if (hash) {
      const t = setTimeout(() => flyToPeriod(hash), 500);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.w === 0]);

  const selectedStar = selectedArtist ? starBySlug.get(selectedArtist) : null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 overflow-hidden bg-[#050810]"
      style={{ overscrollBehavior: "none" }}
    >
      <StarfieldBackground />
      {size.w > 0 && (
        <svg
          ref={svgRef}
          data-testid="timeline-svg"
          width={size.w}
          height={size.h}
          className="absolute inset-0 h-full w-full select-none"
          style={{ touchAction: "none", cursor: "grab" }}
          aria-label="Zoomable timeline of art history"
        >
          <g ref={worldRef}>
            <NebulaLayer nebulae={nebulae} stars={stars} onNebulaClick={flyToPeriod} />
          </g>
          <StarLayer
            stars={stars}
            nebulae={nebulae}
            labelRows={labelRows}
            onStarClick={onStarClick}
          />
        </svg>
      )}
      <YearRuler />
      <FilterDropdown
        periods={periods}
        onSelectPeriod={flyToPeriod}
        onSelectArtist={flyToArtist}
      />
      <div className="pointer-events-none fixed right-5 top-5 z-20 text-right font-serif">
        <p className="text-[15px] tracking-[0.34em] text-[#e8e3d5]/85">MUSÉE</p>
        <p className="mt-0.5 text-[10px] tracking-[0.22em] text-[#8a8470]">
          AN ATLAS OF ART HISTORY
        </p>
      </div>
      <p className="pointer-events-none fixed bottom-[68px] left-1/2 z-20 -translate-x-1/2 text-[11px] tracking-[0.2em] text-[#6b6555]">
        SCROLL TO DIVE · DRAG TO DRIFT · CLICK A STAR
      </p>
      {selectedStar && (
        <ArtistCard
          star={selectedStar}
          onClose={() => {
            const store = useTimelineStore.getState();
            store.setSelectedArtist(null);
            if (store.focus?.kind === "artist") store.setFocus(null);
          }}
        />
      )}
    </div>
  );
}
