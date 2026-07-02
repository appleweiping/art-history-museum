import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export interface CameraTransform {
  x: number;
  y: number;
  k: number;
}

export type Focus =
  | { kind: "period"; slug: string }
  | { kind: "artist"; slug: string }
  | null;

interface TimelineState {
  /** Transient — subscribed imperatively, never via hooks (updates every zoom tick). */
  transform: CameraTransform;
  /** LOD band index (0 galaxy / 1 constellation / 2 star) — React state. */
  band: number;
  focus: Focus;
  hoveredArtist: string | null;
  selectedArtist: string | null;
  ready: boolean;
  setTransform: (t: CameraTransform) => void;
  setBand: (b: number) => void;
  setFocus: (f: Focus) => void;
  setHoveredArtist: (slug: string | null) => void;
  setSelectedArtist: (slug: string | null) => void;
  setReady: (r: boolean) => void;
}

export const useTimelineStore = create<TimelineState>()(
  subscribeWithSelector((set) => ({
    transform: { x: 0, y: 0, k: 1 },
    band: 0,
    focus: null,
    hoveredArtist: null,
    selectedArtist: null,
    ready: false,
    setTransform: (transform) => set({ transform }),
    setBand: (band) => set({ band }),
    setFocus: (focus) => set({ focus }),
    setHoveredArtist: (hoveredArtist) => set({ hoveredArtist }),
    setSelectedArtist: (selectedArtist) => set({ selectedArtist }),
    setReady: (ready) => set({ ready }),
  })),
);
