"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { NebulaNode, StarNode } from "@/lib/scales";
import { xForYear, smoothstep } from "@/lib/scales";
import { LOD } from "@/lib/constants";
import { useTimelineStore } from "@/stores/timelineStore";

interface Props {
  nebulae: NebulaNode[];
  stars: StarNode[];
  onNebulaClick: (slug: string) => void;
}

/**
 * World-space layer: nebula gradient blobs that physically grow as you zoom,
 * plus the hovered artist's date-span bar. Glow comes from stacked radial
 * gradients with screen blending — no feGaussianBlur (the SVG perf trap).
 */
export default function NebulaLayer({ nebulae, stars, onNebulaClick }: Props) {
  const rootRef = useRef<SVGGElement>(null);
  const lodRefs = useRef(new Map<string, SVGGElement>());
  const hoveredArtist = useTimelineStore((s) => s.hoveredArtist);
  const focus = useTimelineStore((s) => s.focus);

  // LOD fade (imperative — fires every zoom tick)
  useEffect(() => {
    return useTimelineStore.subscribe(
      (s) => s.transform,
      (t) => {
        const opacity = 1 - 0.55 * smoothstep(LOD.nebulaFade[0], LOD.nebulaFade[1], t.k);
        for (const g of lodRefs.current.values()) {
          g.setAttribute("opacity", String(opacity));
        }
      },
      { fireImmediately: true },
    );
  }, []);

  // Focus dimming (low frequency — GSAP tween per nebula)
  useGSAP(
    () => {
      if (!rootRef.current) return;
      for (const n of nebulae) {
        const dim =
          focus == null
            ? 1
            : focus.kind === "period" && focus.slug === n.period.slug
              ? 1
              : focus.kind === "artist" &&
                  stars.find((s) => s.artist.slug === focus.slug)?.periodSlug === n.period.slug
                ? 1
                : 0.12;
        gsap.to(rootRef.current.querySelector(`[data-nebula-dim="${n.period.slug}"]`), {
          attr: { opacity: dim },
          duration: 0.9,
          ease: "power2.inOut",
        });
        if (focus?.kind === "period" && focus.slug === n.period.slug) {
          // the chosen nebula overshoots then settles
          const el = rootRef.current.querySelector(`[data-nebula-pulse="${n.period.slug}"]`);
          gsap.fromTo(
            el,
            { scale: 1, transformOrigin: "center center" },
            { scale: 1.12, duration: 0.5, ease: "back.out(1.4)", yoyo: true, repeat: 1 },
          );
        }
      }
    },
    { dependencies: [focus], scope: rootRef },
  );

  const hovered = hoveredArtist
    ? stars.find((s) => s.artist.slug === hoveredArtist)
    : null;

  return (
    <g ref={rootRef}>
      <defs>
        {nebulae.map((n) => (
          <radialGradient key={n.period.slug} id={`neb-${n.period.slug}`}>
            <stop offset="0%" stopColor={n.period.color} stopOpacity={0.85} />
            <stop offset="45%" stopColor={n.period.color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={n.period.color} stopOpacity={0} />
          </radialGradient>
        ))}
      </defs>
      {nebulae.map((n) => (
        <g
          key={n.period.slug}
          ref={(el) => {
            if (el) lodRefs.current.set(n.period.slug, el);
            else lodRefs.current.delete(n.period.slug);
          }}
          data-testid={`nebula-${n.period.slug}`}
        >
          <g data-nebula-dim={n.period.slug}>
            <g data-nebula-pulse={n.period.slug}>
              <ellipse
                cx={n.cx}
                cy={n.cy}
                rx={n.rx * 1.45}
                ry={n.ry * 1.5}
                fill={`url(#neb-${n.period.slug})`}
                opacity={0.28}
                style={{ mixBlendMode: "screen" }}
              />
              <ellipse
                cx={n.cx}
                cy={n.cy}
                rx={n.rx}
                ry={n.ry}
                fill={`url(#neb-${n.period.slug})`}
                opacity={0.55}
                style={{ mixBlendMode: "screen" }}
              />
              <ellipse
                cx={n.cx - n.rx * 0.15}
                cy={n.cy - n.ry * 0.1}
                rx={n.rx * 0.5}
                ry={n.ry * 0.55}
                fill={`url(#neb-${n.period.slug})`}
                opacity={0.75}
                style={{ mixBlendMode: "screen" }}
              />
              {/* hit area */}
              <ellipse
                cx={n.cx}
                cy={n.cy}
                rx={n.rx}
                ry={n.ry}
                fill="transparent"
                className="cursor-pointer"
                onClick={() => onNebulaClick(n.period.slug)}
              />
            </g>
          </g>
        </g>
      ))}
      {hovered && (
        <g className="pointer-events-none">
          <line
            x1={xForYear(hovered.artist.activeFrom)}
            x2={xForYear(hovered.artist.activeTo)}
            y1={hovered.y}
            y2={hovered.y}
            stroke={hovered.color}
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
            opacity={0.8}
          />
          {[hovered.artist.activeFrom, hovered.artist.activeTo].map((yr) => (
            <circle
              key={yr}
              cx={xForYear(yr)}
              cy={hovered.y}
              r={3}
              fill={hovered.color}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>
      )}
    </g>
  );
}
