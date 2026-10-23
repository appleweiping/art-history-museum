"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { LabelBox, NebulaNode, Rect, StarNode } from "@/lib/scales";
import {
  clampLabelX,
  initialView,
  overlaps,
  placeLabels,
  shortPeriodName,
  smoothstep,
} from "@/lib/scales";
import { LOD, RULER_HEIGHT } from "@/lib/constants";
import { useTimelineStore, type Focus } from "@/stores/timelineStore";

interface Props {
  stars: StarNode[];
  nebulae: NebulaNode[];
  viewport: { w: number; h: number };
  onStarClick: (slug: string) => void;
}

interface LabelSlot {
  /** measured text width / height in px */
  w: number;
  h: number;
  /** vertical offset from the nebula centre chosen at the opening view; null = no free slot */
  dy: number | null;
  smallW: number;
}

/** keep labels clear of the filter/title bar and the ruler + hint line */
const TOP_UI = 72;
const BOTTOM_UI = RULER_HEIGHT + 36;
/** distance of the zoomed-in "NAME · years" label above its nebula centre */
const SMALL_LABEL_RISE = 120;

/** the filter button (top left) and the title (top right) */
function cornerUi(vw: number): Rect[] {
  return [
    { x0: 0, y0: 0, x1: 200, y1: TOP_UI },
    { x0: vw - (vw < 640 ? 110 : 200), y0: 0, x1: vw, y1: TOP_UI },
  ];
}

/** a label that would be cut off by the screen edge is hidden instead */
function onScreen(r: Rect, vw: number): boolean {
  return r.x0 >= 0 && r.x1 <= vw;
}

function dimFor(focus: Focus, periodSlug: string, artistSlug: string): number {
  if (focus == null) return 1;
  if (focus.kind === "period") return focus.slug === periodSlug ? 1 : 0.12;
  return focus.slug === artistSlug ? 1 : 0.25;
}

/** label colour: the period's nebula colour lifted most of the way to ivory */
function tint(hex: string): string {
  const ivory = [0xe8, 0xe3, 0xd5];
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  if (c.some(Number.isNaN)) return "#e8e3d5";
  const mixed = c.map((v, i) => Math.round(v * 0.35 + ivory[i] * 0.65));
  return `rgb(${mixed.join(",")})`;
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
 *
 * Period labels never overlap: their rows are packed once for the opening
 * view, and on every tick any label that would still touch a label already
 * drawn is faded out until zooming in gives it room.
 */
export default function StarLayer({ stars, nebulae, viewport, onStarClick }: Props) {
  const rootRef = useRef<SVGGElement>(null);
  const starRefs = useRef(new Map<string, SVGGElement>());
  const bigRefs = useRef(new Map<string, SVGTextElement>());
  const smallRefs = useRef(new Map<string, SVGTextElement>());
  const leaderRefs = useRef(new Map<string, SVGLineElement>());
  const slots = useRef(new Map<string, LabelSlot>());
  const focus = useTimelineStore((s) => s.focus);
  const focusRef = useRef(focus);
  focusRef.current = focus;

  const bigFont = viewport.w < 640 ? 13 : 16;
  const smallFont = viewport.w < 640 ? 12 : 14;

  // pack the galaxy-view labels for the opening camera (and again once the
  // web font has loaded, since that changes the measured widths)
  useLayoutEffect(() => {
    let cancelled = false;
    const pack = () => {
      if (cancelled) return;
      const start = initialView(viewport.w, viewport.h);
      const boxes: LabelBox[] = [];
      const measured = new Map<string, { w: number; smallW: number }>();
      for (const n of nebulae) {
        const big = bigRefs.current.get(n.period.slug);
        const small = smallRefs.current.get(n.period.slug);
        if (!big) continue;
        const w = big.getBBox().width + 8;
        measured.set(n.period.slug, { w, smallW: (small?.getBBox().width ?? 0) + 8 });
        boxes.push({
          slug: n.period.slug,
          sx: start.x + n.cx * start.k,
          sy: start.y + n.cy * start.k,
          reach: n.rx * start.k,
          w,
          h: bigFont + 6,
          // upper lanes fan their labels upwards, the rest downwards
          prefer: n.period.laneY < 500 ? -1 : 1,
        });
      }
      const offsets = placeLabels(
        boxes,
        viewport.w,
        { top: TOP_UI, bottom: viewport.h - BOTTOM_UI },
        bigFont + 12,
        5,
      );
      slots.current = new Map(
        [...measured].map(([slug, m]) => [
          slug,
          { w: m.w, h: bigFont + 6, dy: offsets.get(slug) ?? null, smallW: m.smallW },
        ]),
      );
      // repaint with the new slots
      const t = useTimelineStore.getState().transform;
      useTimelineStore.getState().setTransform({ ...t });
    };
    pack();
    document.fonts?.ready.then(pack);
    return () => {
      cancelled = true;
    };
  }, [nebulae, viewport.w, viewport.h, bigFont]);

  // projection + LOD, every zoom tick
  useEffect(() => {
    const update = (t: { x: number; y: number; k: number }) => {
      const k = t.k;
      const vw = viewport.w;
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

      // labels that were given a slot at the opening view get first claim
      const order = [...nebulae].sort((a, b) => {
        const pa = slots.current.get(a.period.slug)?.dy == null ? 1 : 0;
        const pb = slots.current.get(b.period.slug)?.dy == null ? 1 : 0;
        return pa - pb || a.cx - b.cx;
      });
      const bigTaken: Rect[] = cornerUi(vw);
      const smallTaken: Rect[] = cornerUi(vw);
      for (const n of order) {
        const slug = n.period.slug;
        const big = bigRefs.current.get(slug);
        const small = smallRefs.current.get(slug);
        const slot = slots.current.get(slug);
        if (!big || !small || !slot) continue;
        const dim = dimFor(focusRef.current, slug, "");
        const sx = t.x + n.cx * k;
        const sy = t.y + n.cy * k;
        const reach = n.rx * k;

        const bx = clampLabelX(sx, slot.w, reach, vw);
        const by = sy + (slot.dy ?? 0);
        const bigRect = {
          x0: bx - slot.w / 2,
          x1: bx + slot.w / 2,
          y0: by - slot.h / 2,
          y1: by + slot.h / 2,
        };
        const bigVisible =
          bigOp > 0.02 && onScreen(bigRect, vw) && !bigTaken.some((r) => overlaps(r, bigRect, 4));
        if (bigVisible) bigTaken.push(bigRect);
        big.setAttribute("x", String(bx));
        big.setAttribute("y", String(by + bigFont * 0.35));
        big.setAttribute("opacity", String(bigOp * dim));
        (big.parentNode as SVGGElement).style.opacity = bigVisible ? "1" : "0";
        // a label moved off its nebula gets a faint leader line back to it
        const leader = leaderRefs.current.get(slug);
        if (leader) {
          const dy = slot.dy ?? 0;
          const show = dy !== 0 && bigVisible;
          const edge = by + (dy < 0 ? slot.h / 2 : -slot.h / 2);
          const tip = sy + (dy < 0 ? -5 : 5);
          leader.setAttribute("x1", String(bx));
          leader.setAttribute("y1", String(edge));
          leader.setAttribute("x2", String(sx));
          leader.setAttribute("y2", String(tip));
          leader.setAttribute("opacity", show ? String(0.5 * bigOp * dim) : "0");
        }

        const smallOp = (1 - bigOp) * 0.8;
        const sxs = clampLabelX(sx, slot.smallW, reach, vw);
        // stay below the title bar while the nebula is still on screen
        const sys = Math.min(
          Math.max(sy - SMALL_LABEL_RISE, TOP_UI + smallFont),
          sy - SMALL_LABEL_RISE + n.ry * k * 0.8,
        );
        const smallRect = {
          x0: sxs - slot.smallW / 2,
          x1: sxs + slot.smallW / 2,
          y0: sys - smallFont,
          y1: sys + 4,
        };
        const smallVisible =
          smallOp > 0.02 &&
          onScreen(smallRect, vw) &&
          !smallTaken.some((r) => overlaps(r, smallRect, 4));
        if (smallVisible) smallTaken.push(smallRect);
        small.setAttribute("x", String(sxs));
        small.setAttribute("y", String(sys));
        small.setAttribute("opacity", String(smallOp * dim));
        (small.parentNode as SVGGElement).style.opacity = smallVisible ? "1" : "0";
      }
    };
    const unsub = useTimelineStore.subscribe((s) => s.transform, update, {
      fireImmediately: true,
    });
    return unsub;
  }, [stars, nebulae, viewport.w, bigFont, smallFont]);

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
          data-testid={`period-label-${n.period.slug}`}
          className="pointer-events-none select-none"
        >
          <line
            ref={(el) => {
              if (el) leaderRefs.current.set(n.period.slug, el);
              else leaderRefs.current.delete(n.period.slug);
            }}
            stroke={n.period.color}
            strokeWidth={1}
            opacity={0}
          />
          <g style={{ transition: "opacity 240ms ease-out" }}>
            <text
              ref={(el) => {
                if (el) bigRefs.current.set(n.period.slug, el);
                else bigRefs.current.delete(n.period.slug);
              }}
              data-big
              textAnchor="middle"
              className="font-serif"
              style={{
                fontSize: bigFont,
                letterSpacing: "0.16em",
                fontWeight: 600,
                fill: tint(n.period.color),
              }}
            >
              {shortPeriodName(n.period.name).toUpperCase()}
            </text>
          </g>
          <g style={{ transition: "opacity 240ms ease-out" }}>
            <text
              ref={(el) => {
                if (el) smallRefs.current.set(n.period.slug, el);
                else smallRefs.current.delete(n.period.slug);
              }}
              data-small
              textAnchor="middle"
              className="fill-[#b7b1a0] font-serif"
              style={{ fontSize: smallFont, letterSpacing: "0.14em" }}
            >
              {n.period.name.toUpperCase()} · {n.period.startYear}–{n.period.endYear}
            </text>
          </g>
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
