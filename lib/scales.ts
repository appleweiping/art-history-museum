import { scaleLinear } from "d3-scale";
import type { TimelineArtist, TimelinePeriod } from "./types";
import { PX_PER_YEAR, WORLD_H, WORLD_W, YEAR_MAX, YEAR_MIN } from "./constants";

export const yearScale = scaleLinear()
  .domain([YEAR_MIN, YEAR_MAX])
  .range([0, WORLD_W]);

export function xForYear(year: number): number {
  return yearScale(year);
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
      ry: 130,
    };
  });
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
