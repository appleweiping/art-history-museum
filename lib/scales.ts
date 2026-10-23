import { scaleLinear } from "d3-scale";
import type { TimelineArtist, TimelinePeriod } from "./types";
import { K_FIT_MIN, K_START_NARROW, WORLD_H, WORLD_W, X_STOPS, YEAR_STOPS } from "./constants";

/** Piecewise-linear year → world x (see YEAR_STOPS). Clamped to the axis. */
export const yearScale = scaleLinear().domain(YEAR_STOPS).range(X_STOPS).clamp(true);

export function xForYear(year: number): number {
  return yearScale(year);
}

/** World pixels per year inside the axis segment that contains `year`. */
export function worldPxPerYear(year: number): number {
  for (let i = 0; i < YEAR_STOPS.length - 1; i++) {
    if (year < YEAR_STOPS[i + 1] || i === YEAR_STOPS.length - 2) {
      return (X_STOPS[i + 1] - X_STOPS[i]) / (YEAR_STOPS[i + 1] - YEAR_STOPS[i]);
    }
  }
  return 0;
}

/**
 * Camera the timeline opens with: everything in view when the screen is wide
 * enough, otherwise a readable scale anchored at the left (earliest) edge.
 */
export function initialView(width: number, height: number): {
  x: number;
  y: number;
  k: number;
  fitK: number;
} {
  const fitK = Math.min(width / (WORLD_W * 1.06), height / (WORLD_H * 1.06));
  const k = fitK >= K_FIT_MIN ? fitK : K_START_NARROW;
  const x = k === fitK ? width / 2 - (WORLD_W / 2) * k : 12;
  const y = height / 2 - (WORLD_H / 2) * k;
  return { x, y, k, fitK };
}

/** Gentle Milky Way arc so lanes don't read as spreadsheet rows. */
export function laneDrift(x: number): number {
  return 60 * Math.sin((x / WORLD_W) * Math.PI);
}

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** Deterministic string hash → [-1, 1). */
function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) / 0xffffffff) * 2 - 1;
}

export interface StarNode {
  artist: TimelineArtist;
  periodSlug: string;
  color: string;
  x: number;
  y: number;
}

export interface NebulaNode {
  period: TimelinePeriod;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export function layoutNebulae(periods: TimelinePeriod[]): NebulaNode[] {
  return periods.map((p) => {
    const x0 = xForYear(p.startYear);
    const x1 = xForYear(p.endYear);
    const cx = (x0 + x1) / 2;
    return {
      period: p,
      cx,
      cy: p.laneY + laneDrift(cx),
      rx: Math.max(180, ((x1 - x0) / 2) * 1.15),
      ry: 150,
    };
  });
}

/** Galaxy-view display name (drop "& …" suffixes that would never fit). */
export function shortPeriodName(name: string): string {
  return name.split("&")[0].trim();
}

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export function overlaps(a: Rect, b: Rect, pad = 0): boolean {
  return a.x0 < b.x1 + pad && b.x0 < a.x1 + pad && a.y0 < b.y1 + pad && b.y0 < a.y1 + pad;
}

/**
 * Horizontal screen position for a label of width `w` whose anchor is at `sx`:
 * kept inside the viewport while its nebula (screen half-width `reach`) is
 * still on screen, then allowed to slide off with it. Continuous in `sx`.
 */
export function clampLabelX(sx: number, w: number, reach: number, vw: number, margin = 10): number {
  const lo = w / 2 + margin;
  const hi = vw - w / 2 - margin;
  const inside = lo > hi ? vw / 2 : Math.min(hi, Math.max(lo, sx));
  return Math.min(sx + reach, Math.max(sx - reach, inside));
}

export interface LabelBox {
  slug: string;
  /** anchor in screen space (nebula centre) */
  sx: number;
  sy: number;
  /** nebula half-width on screen */
  reach: number;
  w: number;
  h: number;
  /** which side to try first when the nebula centre is taken: -1 above, 1 below */
  prefer: -1 | 1;
}

/**
 * Greedy 2D placement of the galaxy-view period labels: each label tries its
 * nebula centre, then rows on its preferred side (away from the middle of the
 * band, so labels fan outwards), then the other side, and takes the first slot
 * that collides with nothing already placed. Returns a vertical offset per label,
 * or null when no slot is free (the label stays hidden until zooming in makes
 * room). Labels are visited left to right.
 */
export function placeLabels(
  boxes: LabelBox[],
  vw: number,
  band: { top: number; bottom: number },
  rowStep: number,
  maxRows: number,
): Map<string, number | null> {
  const placed: Rect[] = [];
  const out = new Map<string, number | null>();
  const sorted = [...boxes].sort((a, b) => a.sx - b.sx);
  for (const b of sorted) {
    const candidates = [0];
    for (let r = 1; r <= maxRows; r++) candidates.push(b.prefer * r * rowStep);
    for (let r = 1; r <= maxRows; r++) candidates.push(-b.prefer * r * rowStep);
    const cx = clampLabelX(b.sx, b.w, b.reach, vw);
    let chosen: number | null = null;
    for (const dy of candidates) {
      const r: Rect = {
        x0: cx - b.w / 2,
        x1: cx + b.w / 2,
        y0: b.sy + dy - b.h / 2,
        y1: b.sy + dy + b.h / 2,
      };
      if (r.y0 < band.top || r.y1 > band.bottom) continue;
      if (placed.some((p) => overlaps(p, r, 6))) continue;
      placed.push(r);
      chosen = dy;
      break;
    }
    out.set(b.slug, chosen);
  }
  return out;
}

/** Star positions: x = active midpoint, y = lane + deterministic jitter, then a greedy de-overlap pass. */
export function layoutStars(periods: TimelinePeriod[]): StarNode[] {
  const stars: StarNode[] = [];
  for (const p of periods) {
    for (const a of p.artists) {
      const mid = (a.activeFrom + a.activeTo) / 2;
      const x = xForYear(mid);
      const jitter = hash01(a.slug) * 70;
      stars.push({
        artist: a,
        periodSlug: p.slug,
        color: p.color,
        x,
        y: p.laneY + laneDrift(x) + jitter + a.yOffset,
      });
    }
  }
  stars.sort((a, b) => a.x - b.x);
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 1; i < stars.length; i++) {
      for (let j = i - 1; j >= 0 && stars[i].x - stars[j].x < 40; j--) {
        if (Math.abs(stars[i].y - stars[j].y) < 45) {
          stars[i].y = stars[j].y + (stars[i].y >= stars[j].y ? 45 : -45);
        }
      }
    }
  }
  for (const s of stars) {
    s.y = Math.min(WORLD_H - 120, Math.max(120, s.y));
  }
  return stars;
}

/** Bounding box (world coords) of a period's nebula + its stars, for fly-to. */
export function periodBounds(
  nebula: NebulaNode,
  stars: StarNode[],
): { x0: number; y0: number; x1: number; y1: number } {
  let x0 = nebula.cx - nebula.rx;
  let x1 = nebula.cx + nebula.rx;
  let y0 = nebula.cy - nebula.ry;
  let y1 = nebula.cy + nebula.ry;
  for (const s of stars) {
    if (s.periodSlug !== nebula.period.slug) continue;
    x0 = Math.min(x0, s.x - 60);
    x1 = Math.max(x1, s.x + 60);
    y0 = Math.min(y0, s.y - 60);
    y1 = Math.max(y1, s.y + 60);
  }
  return { x0, y0, x1, y1 };
}
