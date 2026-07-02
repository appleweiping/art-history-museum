"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { NebulaNode, StarNode } from "@/lib/scales";
import { shortPeriodName, smoothstep } from "@/lib/scales";
import { LOD } from "@/lib/constants";
import { useTimelineStore, type Focus } from "@/stores/timelineStore";

interface Props {
  stars: StarNode[];
  nebulae: NebulaNode[];
  /** screen-space vertical fan offsets for galaxy-view labels, by period slug */
  labelRows: Map<string, number>;
  onStarClick: (slug: string) => void;
}

function dimFor(focus: Focus, periodSlug: string, artistSlug: string): number {
  if (focus == null) return 1;
  if (focus.kind === "period") return focus.slug === periodSlug ? 1 : 0.12;
  return focus.slug === artistSlug ? 1 : 0.25;
}

function dates(a: StarNode["artist"]): string {
  const b = a.birthYear != null ? String(a.birthYear) : "?";
  const d = a.deathYear != null ? String(a.deathYear) : "";
  return `${b} – ${d}`;
}

/**
 * Screen-space layer: artist stars and all text labels stay constant pixel
 * size and razor sharp — positions are re-projected imperatively on every
 * zoom tick, bypassing React entirely.
 */
export default function StarLayer({ stars, nebulae, labelRows, onStarClick }: Props) {
  const rootRef = useRef<SVGGElement>(null);
  const starRefs = useRef(new Map<string, SVGGElement>());
  const labelRefs = useRef(new Map<string, SVGGElement>());
  const focus = useTimelineStore((s) => s.focus);
  const focusRef = useRef(focus);
  focusRef.current = focus;

  // projection + LOD, every zoom tick
  useEffect(() => {
    const update = (t: { x: number; y: number; k: number }) => {
      const k = t.k;
      const starOp = smoothstep(LOD.starIn[0], LOD.starIn[1], k);
      const nameOp = smoothstep(LOD.starLabelIn[0], LOD.starLabelIn[1], k);
      const dateOp = smoothstep(LOD.dateLabelIn[0], LOD.dateLabelIn[1], k);
      const bigOp = 1 - smoothstep(LOD.starIn[0], LOD.starIn[1], k);

      for (const s of stars) {
        const g = starRefs.current.get(s.artist.slug);
        if (!g) continue;
        const dim = dimFor(focusRef.current, s.periodSlug, s.artist.slug);
        g.setAttribute(
          "transform",
          `translate(${t.x + s.x * k},${t.y + s.y * k})`,
        );
        const op = starOp * dim;
        g.setAttribute("opacity", String(op));
        g.style.pointerEvents = op < 0.1 ? "none" : "auto";
        const name = g.querySelector<SVGTextElement>("[data-name]");
        if (name) name.setAttribute("opacity", String(nameOp));
        const date = g.querySelector<SVGTextElement>("[data-dates]");
        if (date) date.setAttribute("opacity", String(dateOp));
      }

      for (const n of nebulae) {
        const g = labelRefs.current.get(n.period.slug);
        if (!g) continue;
        const dim = dimFor(focusRef.current, n.period.slug, "");
        g.setAttribute(
          "transform",
          `translate(${t.x + n.cx * k},${t.y + n.cy * k})`,
        );
        const big = g.querySelector<SVGTextElement>("[data-big]");
        if (big) big.setAttribute("opacity", String(bigOp * dim));
        const small = g.querySelector<SVGTextElement>("[data-small]");
        if (small) small.setAttribute("opacity", String((1 - bigOp) * 0.8 * dim));
      }
    };
    const unsub = useTimelineStore.subscribe((s) => s.transform, update, {
      fireImmediately: true,
    });
    return unsub;
  }, [stars, nebulae]);

  // re-apply dimming when focus changes (transform may be static right then)
  useEffect(() => {
    const t = useTimelineStore.getState().transform;
    useTimelineStore.getState().setTransform({ ...t });
  }, [focus]);

  // pulse ring on artist focus
  useGSAP(
    () => {
      if (focus?.kind !== "artist" || !rootRef.current) return;
      const ring = rootRef.current.querySelector(
        `[data-ring="${focus.slug}"]`,
      );
      if (!ring) return;
      gsap.fromTo(
        ring,
        { attr: { r: 8 }, opacity: 0.9 },
        {
          attr: { r: 46 },
          opacity: 0,
          duration: 1.1,
          ease: "power1.out",
          repeat: 1,
          delay: 0.9,
        },
      );
    },
    { dependencies: [focus], scope: rootRef },
  );

  const setHover = (slug: string | null) =>
    useTimelineStore.getState().setHoveredArtist(slug);

  return (
    <g ref={rootRef}>
      <defs>
        <radialGradient id="star-halo">
          <stop offset="0%" stopColor="#fff8e7" stopOpacity={0.9} />
          <stop offset="35%" stopColor="#e8e3d5" stopOpacity={0.28} />
          <stop offset="100%" stopColor="#e8e3d5" stopOpacity={0} />
        </radialGradient>
      </defs>

      {/* period labels */}
      {nebulae.map((n) => (
        <g
          key={n.period.slug}
          ref={(el) => {
            if (el) labelRefs.current.set(n.period.slug, el);
            else labelRefs.current.delete(n.period.slug);
          }}
          className="pointer-events-none select-none"
        >
          <text
            data-big
            textAnchor="middle"
            y={labelRows.get(n.period.slug) ?? 0}
            className="fill-[#e8e3d5] font-serif"
            style={{ fontSize: 22, letterSpacing: "0.2em" }}
          >
            {shortPeriodName(n.period.name).toUpperCase()}
          </text>
          <text
            data-small
            textAnchor="middle"
            y={-Math.min(120, n.ry)}
            className="fill-[#b7b1a0] font-serif"
            style={{ fontSize: 15, letterSpacing: "0.14em" }}
          >
            {n.period.name.toUpperCase()} · {n.period.startYear}–{n.period.endYear}
          </text>
        </g>
      ))}

      {/* artist stars */}
      {stars.map((s) => (
        <g
          key={s.artist.slug}
          ref={(el) => {
            if (el) starRefs.current.set(s.artist.slug, el);
            else starRefs.current.delete(s.artist.slug);
          }}
          data-testid={`star-${s.artist.slug}`}
          className="cursor-pointer"
          role="button"
          aria-label={`${s.artist.name}, ${dates(s.artist)}`}
          onClick={() => onStarClick(s.artist.slug)}
          onPointerEnter={() => setHover(s.artist.slug)}
          onPointerLeave={() => setHover(null)}
        >
          <circle data-ring={s.artist.slug} r={8} fill="none" stroke={s.color} strokeWidth={1.5} opacity={0} />
          <g className="star-body transition-transform duration-200 ease-out">
            <circle r={11} fill="url(#star-halo)" style={{ mixBlendMode: "screen" }} />
            <rect x={-9} y={-0.5} width={18} height={1} fill="#fff8e7" opacity={0.5} style={{ mixBlendMode: "screen" }} />
            <rect x={-0.5} y={-9} width={1} height={18} fill="#fff8e7" opacity={0.5} style={{ mixBlendMode: "screen" }} />
            <circle r={2.3} fill="#fff8e7" />
          </g>
          <text
            data-name
            data-testid={`star-label-${s.artist.slug}`}
            textAnchor="middle"
            y={24}
            className="pointer-events-none select-none fill-[#e8e3d5] font-serif"
            style={{ fontSize: 13.5, letterSpacing: "0.06em" }}
          >
            {s.artist.name}
          </text>
          <text
            data-dates
            textAnchor="middle"
            y={39}
            className="pointer-events-none select-none fill-[#9a947f] font-sans"
            style={{ fontSize: 10.5, letterSpacing: "0.1em", fontVariantNumeric: "tabular-nums" }}
          >
            {dates(s.artist)}
          </text>
        </g>
      ))}
    </g>
  );
}
