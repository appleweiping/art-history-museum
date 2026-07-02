"use client";

import { useEffect, useMemo, useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { MuseumArtwork } from "@/lib/types";
import { useMuseumStore } from "@/lib/museum/store";

interface Props {
  artworks: MuseumArtwork[];
}

/**
 * DOM lightbox inspect view: pixel-sharp 1920px reproduction beside the
 * title, year, story and fun facts — with the Commons attribution the
 * license requires.
 */
export default function InspectOverlay({ artworks }: Props) {
  const inspectedId = useMuseumStore((s) => s.inspectedId);
  const rootRef = useRef<HTMLDivElement>(null);
  const artwork = useMemo(
    () => artworks.find((a) => a.id === inspectedId) ?? null,
    [artworks, inspectedId],
  );

  useEffect(() => {
    if (!artwork) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") useMuseumStore.getState().setInspected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [artwork]);

  useGSAP(
    () => {
      if (!artwork || !rootRef.current) return;
      gsap.fromTo(
        rootRef.current,
        { autoAlpha: 0 },
        { autoAlpha: 1, duration: 0.35, ease: "power2.out" },
      );
      gsap.fromTo(
        "[data-inspect-panel]",
        { y: 18, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.5, ease: "power3.out", delay: 0.08 },
      );
    },
    { dependencies: [artwork?.id], scope: rootRef },
  );

  if (!artwork) return null;
  const close = () => useMuseumStore.getState().setInspected(null);

  return (
    <div
      ref={rootRef}
      data-testid="painting-inspect"
      role="dialog"
      aria-label={`${artwork.title} — inspect view`}
      className="absolute inset-0 z-30 flex items-center justify-center bg-[#050810]/78 p-4 backdrop-blur-md md:p-10"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        data-inspect-panel
        className="flex max-h-full w-full max-w-6xl flex-col gap-6 overflow-y-auto rounded-md border border-[#c9a96a]/20 bg-[#0a0e1a]/85 p-5 md:flex-row md:gap-8 md:p-7"
      >
        <div className="flex min-h-0 flex-1 items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={artwork.imageInspectUrl}
            alt={artwork.title}
            className="max-h-[76vh] w-auto max-w-full rounded-[2px] object-contain"
            style={{ boxShadow: "0 24px 70px -18px rgba(0,0,0,0.9)" }}
          />
        </div>

        <div className="w-full shrink-0 md:w-[340px]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2
                data-testid="inspect-title"
                className="font-serif text-[26px] font-semibold leading-tight text-[#f3edda]"
              >
                {artwork.title}
              </h2>
              <p
                className="mt-1 text-[12px] tracking-[0.24em] text-[#c9a96a]"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {artwork.yearText ?? artwork.year ?? "date unknown"}
                <span className="ml-2 text-[#8a8470]">· {artwork.kind.replace("_", " ")}</span>
              </p>
            </div>
            <button
              onClick={close}
              aria-label="Close inspect view"
              data-testid="inspect-close"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#c9a96a]/25 text-[#c9a96a] transition-colors hover:bg-[#c9a96a]/15"
            >
              ✕
            </button>
          </div>

          <div className="mt-4 h-px w-full" style={{ background: "linear-gradient(90deg, #c9a96a55, transparent)" }} />

          <p className="mt-4 font-sans text-[13.5px] leading-[1.7] text-[#cfc9b8]">
            {artwork.story}
          </p>

          {artwork.funFacts.length > 0 && (
            <div className="mt-5">
              <p className="text-[11px] tracking-[0.3em] text-[#c9a96a]" style={{ fontVariantCaps: "small-caps" }}>
                Notes & Curiosities
              </p>
              <ul className="mt-2.5 space-y-2.5">
                {artwork.funFacts.map((f, i) => (
                  <li key={i} className="flex gap-2.5 text-[12.5px] leading-[1.6] text-[#b7b1a0]">
                    <span className="mt-0.5 text-[#c9a96a]">✦</span>
                    <span>
                      {f.text}
                      <span className="ml-1.5 text-[10.5px] text-[#6b6555]">— {f.section}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 border-t border-[#c9a96a]/15 pt-3 text-[10.5px] leading-relaxed text-[#6b6555]">
            <p>
              {artwork.attribution} · {artwork.license}
            </p>
            <p className="mt-1 flex flex-wrap gap-x-3">
              <a
                href={artwork.filePageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline-offset-2 hover:text-[#c9a96a] hover:underline"
              >
                Wikimedia Commons
              </a>
              {artwork.wikipediaUrl && (
                <a
                  href={artwork.wikipediaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline-offset-2 hover:text-[#c9a96a] hover:underline"
                >
                  Wikipedia article
                </a>
              )}
              <a
                href={artwork.imageOriginalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline-offset-2 hover:text-[#c9a96a] hover:underline"
              >
                Full resolution
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
