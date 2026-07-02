"use client";

import { useEffect, useRef } from "react";
import { useTimelineStore } from "@/stores/timelineStore";

const TILE_W = 1600;
const TILE_H = 1200;
const STAR_COUNT = 260;
const PARALLAX = 0.06;

/** Deterministic PRNG so the sky never changes between renders. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Paint-once tileable starfield, shifted at a fraction of the camera
 * translation for parallax depth. Never repainted during zoom.
 */
export default function StarfieldBackground() {
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.width = TILE_W;
    canvas.height = TILE_H;
    const ctx = canvas.getContext("2d");
    if (!ctx || !divRef.current) return;

    const rand = mulberry32(20260702);
    for (let i = 0; i < STAR_COUNT; i++) {
      const x = rand() * TILE_W;
      const y = rand() * TILE_H;
      const r = 0.4 + rand() * 1.1;
      const alpha = 0.15 + rand() * 0.55;
      // draw wrapped copies so the tile repeats seamlessly
      for (const dx of [0, -TILE_W, TILE_W]) {
        for (const dy of [0, -TILE_H, TILE_H]) {
          ctx.beginPath();
          ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(232, 227, 213, ${alpha})`;
          ctx.fill();
        }
      }
    }
    const el = divRef.current;
    el.style.backgroundImage = `url(${canvas.toDataURL()})`;
    el.style.backgroundRepeat = "repeat";

    return useTimelineStore.subscribe(
      (s) => s.transform,
      (t) => {
        el.style.backgroundPosition = `${(t.x * PARALLAX) % TILE_W}px ${(t.y * PARALLAX) % TILE_H}px`;
      },
      { fireImmediately: true },
    );
  }, []);

  return (
    <div
      ref={divRef}
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        background:
          "radial-gradient(ellipse 120% 90% at 50% 40%, #0a1024 0%, #050810 60%, #03050c 100%)",
      }}
    />
  );
}
