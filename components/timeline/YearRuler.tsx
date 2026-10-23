"use client";

import { useEffect, useRef } from "react";
import { worldPxPerYear, yearScale } from "@/lib/scales";
import { RULER_HEIGHT, TICK_STEPS, YEAR_MAX, YEAR_MIN, YEAR_STOPS } from "@/lib/constants";
import { useTimelineStore } from "@/stores/timelineStore";

const SVG_NS = "http://www.w3.org/2000/svg";
/** minimum distance between year labels, in screen px */
const LABEL_GAP = 44;

/**
 * Fixed bottom year ruler. Ticks are rebuilt imperatively from the camera
 * transform (century → decade → year as you dive in). The axis is piecewise
 * linear, so the tick step is chosen per axis segment from its own
 * pixels-per-year.
 */
export default function YearRuler() {
  const gRef = useRef<SVGGElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const g = gRef.current;
    const svg = svgRef.current;
    if (!g || !svg) return;

    const rebuild = (t: { x: number; y: number; k: number }) => {
      const vw = svg.clientWidth || window.innerWidth;
      const yearAt = (sx: number) => yearScale.invert((sx - t.x) / t.k);
      const xAt = (year: number) => t.x + yearScale(year) * t.k;
      const y0 = Math.max(YEAR_MIN, Math.floor(yearAt(-60)));
      const y1 = Math.min(YEAR_MAX, Math.ceil(yearAt(vw + 60)));

      // year → isMajor; a year that is major in any segment stays major
      const ticks = new Map<number, boolean>();
      for (let i = 0; i < YEAR_STOPS.length - 1; i++) {
        const s0 = Math.max(y0, YEAR_STOPS[i]);
        const s1 = Math.min(y1, YEAR_STOPS[i + 1]);
        if (s0 > s1) continue;
        const ppy = worldPxPerYear(YEAR_STOPS[i]) * t.k;
        const { major, minor } =
          TICK_STEPS.find((s) => ppy >= s.minPpy) ?? TICK_STEPS[TICK_STEPS.length - 1];
        if (minor > 0) {
          for (let y = Math.ceil(s0 / minor) * minor; y <= s1; y += minor) {
            if (!ticks.has(y)) ticks.set(y, false);
          }
        }
        for (let y = Math.ceil(s0 / major) * major; y <= s1; y += major) {
          ticks.set(y, true);
        }
      }

      const frag = document.createDocumentFragment();
      let lastLabelX = -Infinity;
      for (const year of [...ticks.keys()].sort((a, b) => a - b)) {
        const isMajor = ticks.get(year)!;
        const x = xAt(year);
        const line = document.createElementNS(SVG_NS, "line");
        line.setAttribute("x1", String(x));
        line.setAttribute("x2", String(x));
        line.setAttribute("y1", "0");
        line.setAttribute("y2", isMajor ? "12" : "6");
        line.setAttribute("stroke", "#c9a96a");
        line.setAttribute("stroke-opacity", isMajor ? "0.75" : "0.3");
        frag.appendChild(line);
        // where two segments meet, steps change; skip labels that would touch
        if (isMajor && x - lastLabelX >= LABEL_GAP) {
          lastLabelX = x;
          const text = document.createElementNS(SVG_NS, "text");
          text.setAttribute("x", String(x));
          text.setAttribute("y", "30");
          text.setAttribute("text-anchor", "middle");
          text.setAttribute("fill", "#b7b1a0");
          text.setAttribute(
            "style",
            "font-size:11px;font-variant-numeric:tabular-nums;letter-spacing:0.08em",
          );
          text.textContent = String(year);
          frag.appendChild(text);
        }
      }
      g.replaceChildren(frag);
    };

    return useTimelineStore.subscribe((s) => s.transform, rebuild, {
      fireImmediately: true,
    });
  }, []);

  return (
    <div
      data-testid="year-ruler"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-20 border-t border-[#c9a96a]/20"
      style={{
        height: RULER_HEIGHT,
        background: "rgba(5, 8, 16, 0.55)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      <svg ref={svgRef} className="h-full w-full">
        <g ref={gRef} />
      </svg>
    </div>
  );
}
