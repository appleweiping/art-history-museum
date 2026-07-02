"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useProgress } from "@react-three/drei";
import gsap from "gsap";
import type { MuseumData } from "@/lib/types";
import { useMuseumStore } from "@/lib/museum/store";
import InstructionsOverlay from "./InstructionsOverlay";
import InspectOverlay from "./InspectOverlay";

const GalleryCanvas = dynamic(() => import("./GalleryCanvas"), { ssr: false });

declare global {
  interface Window {
    __museum?: {
      ready: boolean;
      artworkIds: number[];
      inspectPainting: (id: number) => void;
    };
  }
}

export default function MuseumShell({ data }: { data: MuseumData }) {
  const [mounted, setMounted] = useState(false);
  const [walkable, setWalkable] = useState(true);
  const [doorOpen, setDoorOpen] = useState(false);
  const fadeRef = useRef<HTMLDivElement>(null);
  const { active, progress } = useProgress();
  const inspected = useMuseumStore((s) => s.inspectedId);
  const loaded = mounted && !active && progress >= 100;

  useEffect(() => {
    setMounted(true);
    const qa = new URLSearchParams(window.location.search).has("qa");
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    setWalkable(!qa && !coarse);
    // fresh room per visit
    const store = useMuseumStore.getState();
    store.setInspected(null);
    store.setHovered(null);
    store.setReady(false);
  }, []);

  // door-fade: black veil lifts once everything is hung
  useEffect(() => {
    if (!loaded || doorOpen) return;
    const t = setTimeout(() => {
      if (fadeRef.current) {
        gsap.to(fadeRef.current, {
          autoAlpha: 0,
          duration: 1.1,
          ease: "power2.inOut",
        });
      }
      setDoorOpen(true);
      useMuseumStore.getState().setReady(true);
      window.__museum = {
        ready: true,
        artworkIds: data.artworks.map((a) => a.id),
        inspectPainting: (id: number) => useMuseumStore.getState().setInspected(id),
      };
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, doorOpen]);

  const requestLock = () => {
    // canvas click-to-lock; PointerLockControls listens on the gl dom element
    const canvas = document.querySelector("canvas");
    (canvas as HTMLCanvasElement | null)?.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
  };

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#050810]">
      <div
        className={`absolute inset-0 transition-[filter] duration-300 ${
          inspected != null ? "blur-[6px] brightness-[0.45]" : ""
        }`}
      >
        {mounted && <GalleryCanvas data={data} walkable={walkable} />}
      </div>

      {/* HUD: reticle + hovered title chip */}
      <Reticle />

      {doorOpen && (
        <InstructionsOverlay
          artistName={data.artist.name}
          periodName={data.artist.periodName}
          walkable={walkable}
          loaded={loaded}
          onEnter={requestLock}
        />
      )}

      <InspectOverlay artworks={data.artworks} />

      {/* persistent exit affordance */}
      <Link
        href="/"
        data-testid="museum-exit"
        className="absolute left-4 top-4 z-40 rounded-lg border border-[#c9a96a]/25 bg-[#0a0e1a]/70 px-3.5 py-2 text-[11px] tracking-[0.2em] text-[#e8e3d5] backdrop-blur-xl transition-colors hover:border-[#c9a96a]/50"
      >
        ← TIMELINE
      </Link>
      <div className="pointer-events-none absolute right-4 top-4 z-10 text-right font-serif">
        <p className="text-[13px] tracking-[0.3em] text-[#e8e3d5]/80">
          {data.artist.name.toUpperCase()}
        </p>
        <p className="mt-0.5 text-[9.5px] tracking-[0.22em] text-[#8a8470]">
          {data.artworks.length} WORKS · {data.artist.periodName.toUpperCase()}
        </p>
      </div>

      {/* door-fade veil */}
      <div
        ref={fadeRef}
        className="pointer-events-none absolute inset-0 z-50 bg-black"
        aria-hidden
      >
        <div className="flex h-full items-center justify-center">
          <p className="animate-pulse font-serif text-[12px] tracking-[0.5em] text-[#c9a96a]/80">
            ENTERING THE GALLERY
          </p>
        </div>
      </div>
    </div>
  );
}

function Reticle() {
  const locked = useMuseumStore((s) => s.locked);
  const hoveredId = useMuseumStore((s) => s.hoveredId);
  if (!locked) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
      <div
        className={`rounded-full border transition-all duration-200 ${
          hoveredId != null
            ? "h-4 w-4 border-[#c9a96a] bg-[#c9a96a]/15"
            : "h-2 w-2 border-[#e8e3d5]/50"
        }`}
      />
      {hoveredId != null && (
        <p className="absolute mt-14 text-[11px] tracking-[0.24em] text-[#c9a96a]">
          CLICK TO INSPECT
        </p>
      )}
    </div>
  );
}
