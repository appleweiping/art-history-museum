"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { StarNode } from "@/lib/scales";
import { useTimelineStore } from "@/stores/timelineStore";

const CARD_W = 340;
const CARD_H = 460;

interface Props {
  star: StarNode;
  onClose: () => void;
}

/**
 * "Ivory Placard" — a warm museum label projected beside the clicked star,
 * the single point of warm light against the night sky.
 */
export default function ArtistCard({ star, onClose }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const a = star.artist;

  // anchor beside the star, following the camera
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const place = (t: { x: number; y: number; k: number }) => {
      const sx = t.x + star.x * t.k;
      const sy = t.y + star.y * t.k;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let left = sx + 36;
      if (left + CARD_W > vw - 16) left = sx - CARD_W - 36;
      let top = sy - CARD_H / 2;
      top = Math.min(vh - CARD_H - 72, Math.max(16, top));
      el.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
    };
    return useTimelineStore.subscribe((s) => s.transform, place, {
      fireImmediately: true,
    });
  }, [star]);

  useGSAP(
    () => {
      gsap.fromTo(
        "[data-card]",
        { autoAlpha: 0, scale: 0.92, y: 10 },
        { autoAlpha: 1, scale: 1, y: 0, duration: 0.45, ease: "power3.out" },
      );
    },
    { scope: rootRef },
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const dates = `${a.birthYear ?? "?"} – ${a.deathYear ?? "present"}`;

  return (
    <>
      {/* click-outside backdrop */}
      <div className="fixed inset-0 z-30" onClick={onClose} aria-hidden />
      <div
        ref={rootRef}
        className="pointer-events-none fixed left-0 top-0 z-40 will-change-transform"
      >
        <div
          data-card
          data-testid="artist-card"
          role="dialog"
          aria-label={`About ${a.name}`}
          className="pointer-events-auto relative overflow-hidden rounded-[3px]"
          style={{
            width: CARD_W,
            background: "linear-gradient(168deg, #f6f1e4 0%, #f0e9d8 55%, #ece3cf 100%)",
            boxShadow:
              "0 30px 70px -18px rgba(0,0,0,0.85), 0 0 0 1px rgba(201,169,106,0.35), 0 0 42px -8px rgba(201,169,106,0.28)",
          }}
        >
          {/* matboard double hairline */}
          <div
            className="pointer-events-none absolute inset-[7px] rounded-[2px]"
            style={{ border: "1px solid #c9bfa8" }}
          />
          <div
            className="pointer-events-none absolute inset-[10px] rounded-[2px]"
            style={{ border: "1px solid rgba(201,191,168,0.45)" }}
          />
          {/* paper grain */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-multiply"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='0.6'/%3E%3C/svg%3E\")",
            }}
          />

          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3.5 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full text-[#8a7a55] transition-colors hover:bg-[#1c1913]/8 hover:text-[#1c1913]"
          >
            ✕
          </button>

          <div className="relative px-7 pb-6 pt-8 text-center">
            {/* arched portrait window */}
            <div
              className="mx-auto mb-5 h-44 w-36 overflow-hidden"
              style={{
                borderRadius: "999px 999px 6px 6px",
                boxShadow:
                  "inset 0 0 0 1px rgba(201,169,106,0.5), inset 0 2px 8px rgba(28,25,19,0.25), 0 1px 0 rgba(255,255,255,0.6)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={a.portraitUrl330}
                alt={`Portrait of ${a.name}`}
                className="h-full w-full object-cover"
                style={{ filter: "sepia(0.28) contrast(1.02) brightness(0.98)" }}
              />
            </div>

            <h2
              className="font-serif text-[26px] font-semibold leading-tight text-[#1c1913]"
              data-testid="artist-card-name"
            >
              {a.name}
            </h2>
            <p
              className="mt-1.5 text-[12px] tracking-[0.28em] text-[#8a7a55]"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {dates}
            </p>

            <div
              className="mx-auto my-4 h-px w-16"
              style={{ background: "linear-gradient(90deg, transparent, #c9a96a, transparent)" }}
            />

            <p className="text-left font-sans text-[13.5px] leading-[1.65] text-[#3a342a] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:6] overflow-hidden">
              {a.bio}
            </p>

            <div className="mt-6 flex items-center justify-center gap-3">
              <Link
                href={`/museum/${a.slug}`}
                data-testid="enter-museum"
                className="group relative inline-flex items-center gap-2 rounded-[3px] px-5 py-2.5 text-[12px] font-medium tracking-[0.18em] text-[#241d10] transition-transform hover:scale-[1.02] active:scale-[0.99]"
                style={{
                  background: "linear-gradient(180deg, #d4b578 0%, #c9a96a 45%, #a98b4f 100%)",
                  boxShadow:
                    "inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -1px 2px rgba(60,42,10,0.35), 0 2px 8px rgba(28,25,19,0.25)",
                  fontVariantCaps: "small-caps",
                }}
              >
                Enter Museum
                <span className="transition-transform group-hover:translate-x-0.5">→</span>
              </Link>
            </div>

            <a
              href={a.wikipediaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3.5 inline-block text-[10.5px] tracking-[0.12em] text-[#8a7a55] underline-offset-2 hover:underline"
            >
              Source: Wikipedia
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
