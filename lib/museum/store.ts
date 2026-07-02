import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

interface MuseumState {
  hoveredId: number | null;
  inspectedId: number | null;
  locked: boolean;
  ready: boolean;
  setHovered: (id: number | null) => void;
  setInspected: (id: number | null) => void;
  setLocked: (locked: boolean) => void;
  setReady: (ready: boolean) => void;
}

export const useMuseumStore = create<MuseumState>()(
  subscribeWithSelector((set) => ({
    hoveredId: null,
    inspectedId: null,
    locked: false,
    ready: false,
    setHovered: (hoveredId) => set({ hoveredId }),
    setInspected: (inspectedId) => set({ inspectedId }),
    setLocked: (locked) => set({ locked }),
    setReady: (ready) => set({ ready }),
  })),
);
