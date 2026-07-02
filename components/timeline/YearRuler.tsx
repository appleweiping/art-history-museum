"use client";

import { useEffect, useRef } from "react";
import { yearScale } from "@/lib/scales";
import { PX_PER_YEAR, RULER_HEIGHT, TICK_STEPS, YEAR_MAX, YEAR_MIN } from "@/lib/constants";
import { useTimelineStore } from "@/stores/timelineStore";

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * Fixed bottom year ruler. Ticks are rebuilt imperatively from the camera
 * transform (century → decade → year as you dive in).
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
      const ppy = PX_PER_YEAR * t.k;
      const { major, minor } = TICK_STEPS.find((s) => ppy >= s.minPpy) ?? TICK_STEPS[TICK_STEPS.length - 1];

      const yearAt = (sx: number) => yearScale.invert((sx - t.x) / t.k);
      const xAt = (year: number) => t.x + yearScale(year) * t.k;
      const y0 = Math.max(YEAR_MIN, Math.floor(yearAt(-60)));
      const y1 = Math.min(YEAR_MAX, Math.ceil(yearAt(vw + 60)));

      const frag = document.createDocumentFragment();
      const addTick = (year: number, isMajor: boolean) => {
        const x = xAt(year);
        const line = document.createElementNS(SVG_NS, "line");
        line.setAttribute("x1", String(x));
        line.setAttribute("x2", String(x));
        line.setAttribute("y1", "0");
        line.setAttribute("y2", isMajor ? "12" : "6");
        line.setAttribute("stroke", "#c9a96a");
        line.setAttribute("stroke-opacity", isMajor ? "0.75" : "0.3");
        frag.appendChild(line);
        if (isMajor) {
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
      };

      if (minor > 0) {
        for (let y = Math.ceil(y0 / minor) * minor; y <= y1; y += minor) {
          if (y % major !== 0) addTick(y, false);
        }
      }
      for (let y = Math.ceil(y0 / major) * major; y <= y1; y += major) {
        addTick(y, true);
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
