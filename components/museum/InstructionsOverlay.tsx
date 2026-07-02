"use client";

import Link from "next/link";
import { useMuseumStore } from "@/lib/museum/store";

interface Props {
  artistName: string;
  periodName: string;
  walkable: boolean;
  loaded: boolean;
  onEnter: () => void;
}

/** Shown until pointer lock engages; returns on ESC with Resume / Exit. */
export default function InstructionsOverlay({
  artistName,
  periodName,
  walkable,
  loaded,
  onEnter,
}: Props) {
  const locked = useMuseumStore((s) => s.locked);
  const inspected = useMuseumStore((s) => s.inspectedId);
  if (locked || inspected != null) return null;

  return (
    <div
      data-testid="museum-instructions"
      className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-6 bg-[#050810]/62 backdrop-blur-[3px]"
    >
      <p className="font-serif text-[13px] tracking-[0.4em] text-[#c9a96a]">
        {periodName.toUpperCase()}
      </p>
      <h1 className="-mt-3 text-center font-serif text-5xl font-semibold tracking-wide text-[#f3edda]">
        {artistName}
      </h1>
      <div className="mx-auto h-px w-24" style={{ background: "linear-gradient(90deg, transparent, #c9a96a, transparent)" }} />
      {walkable ? (
        <>
          <button
            data-testid="museum-enter"
            onClick={onEnter}
            disabled={!loaded}
            className="rounded-[3px] px-7 py-3 text-[13px] font-medium tracking-[0.22em] text-[#241d10] transition-transform hover:scale-[1.03] disabled:opacity-60"
            style={{
              background: "linear-gradient(180deg, #d4b578 0%, #c9a96a 45%, #a98b4f 100%)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.45), 0 4px 16px rgba(0,0,0,0.5)",
              fontVariantCaps: "small-caps",
            }}
          >
            {loaded ? "Step Inside" : "Hanging the paintings…"}
          </button>
          <div className="flex items-center gap-6 text-[11px] tracking-[0.2em] text-[#8a8470]">
            <span>W A S D — walk</span>
            <span>MOUSE — look</span>
            <span>CLICK — inspect a painting</span>
            <span>ESC — release</span>
          </div>
        </>
      ) : (
        <p className="max-w-sm text-center text-[12px] leading-relaxed tracking-[0.14em] text-[#8a8470]">
          DRAG TO LOOK AROUND · PINCH TO MOVE · TAP A PAINTING TO INSPECT
        </p>
      )}
      <Link
        href="/"
        className="mt-2 text-[11px] tracking-[0.2em] text-[#6b6555] underline-offset-4 hover:text-[#c9a96a] hover:underline"
      >
        ← BACK TO THE TIMELINE
      </Link>
    </div>
  );
}
