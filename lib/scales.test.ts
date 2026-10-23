// pnpm test  (node:test through tsx; no browser needed)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import {
  clampLabelX,
  initialView,
  layoutNebulae,
  overlaps,
  placeLabels,
  shortPeriodName,
  yearScale,
  type LabelBox,
  type Rect,
} from "./scales";
import { WORLD_W, YEAR_MAX, YEAR_MIN } from "./constants";
import type { TimelinePeriod } from "./types";

const periods: TimelinePeriod[] = JSON.parse(
  readFileSync(path.join(__dirname, "..", "data", "collection.json"), "utf8"),
).periods;

test("year axis is increasing and spans the world", () => {
  assert.equal(yearScale(YEAR_MIN), 0);
  assert.equal(yearScale(YEAR_MAX), WORLD_W);
  let prev = -1;
  for (let y = YEAR_MIN; y <= YEAR_MAX; y += 5) {
    const x = yearScale(y);
    assert.ok(x > prev, `x(${y}) should be greater than x(${y - 5})`);
    prev = x;
  }
});

test("each nebula is centred inside its own period", () => {
  for (const n of layoutNebulae(periods)) {
    const year = yearScale.invert(n.cx);
    assert.ok(year > n.period.startYear && year < n.period.endYear, n.period.slug);
  }
});

test("narrow screens open at a readable zoom instead of fitting everything", () => {
  const wide = initialView(1280, 720);
  assert.equal(wide.k, wide.fitK);
  const phone = initialView(390, 844);
  assert.ok(phone.k > phone.fitK);
});

/** Rough width of an upper-case 16 px serif label with 0.16em tracking. */
const labelWidth = (name: string) => shortPeriodName(name).length * 14 + 8;

for (const [w, h] of [
  [1280, 720],
  [1920, 1080],
  [1024, 768],
]) {
  test(`galaxy-view labels do not overlap at ${w}x${h}`, () => {
    const start = initialView(w, h);
    const boxes: LabelBox[] = layoutNebulae(periods).map((n) => ({
      slug: n.period.slug,
      sx: start.x + n.cx * start.k,
      sy: start.y + n.cy * start.k,
      reach: n.rx * start.k,
      w: labelWidth(n.period.name),
      h: 22,
      prefer: n.period.laneY < 500 ? -1 : 1,
    }));
    const offsets = placeLabels(boxes, w, { top: 72, bottom: h - 100 }, 28, 5);
    const placed: Rect[] = [];
    for (const b of boxes) {
      const dy = offsets.get(b.slug);
      assert.notEqual(dy, null, `${b.slug} found no free slot`);
      const cx = clampLabelX(b.sx, b.w, b.reach, w);
      placed.push({ x0: cx - b.w / 2, x1: cx + b.w / 2, y0: b.sy + dy! - 11, y1: b.sy + dy! + 11 });
    }
    const hits: string[] = [];
    const rows = boxes.map((b, i) => ({ slug: b.slug, r: placed[i] }));
    for (let i = 0; i < rows.length; i++)
      for (let j = i + 1; j < rows.length; j++)
        if (overlaps(rows[i].r, rows[j].r)) hits.push(`${rows[i].slug} / ${rows[j].slug}`);
    assert.deepEqual(hits, []);
  });
}
