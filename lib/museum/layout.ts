import type { MuseumArtwork } from "@/lib/types";

export const WALL_HEIGHT = 3.6;
export const ROOM_WIDTH = 9;
export const EYE_HEIGHT = 1.65;
export const PICTURE_CENTER = 1.62;
const SLOT_PITCH = 2.7;
const CORNER_MARGIN = 1.35;

export interface PaintingPlacement {
  artwork: MuseumArtwork;
  position: [number, number, number];
  rotationY: number;
  width: number; // canvas width in meters
  height: number;
}

export interface LightPlacement {
  position: [number, number, number];
  target: [number, number, number];
}

export interface GalleryLayout {
  width: number; // x extent
  length: number; // z extent
  paintings: PaintingPlacement[];
  lights: LightPlacement[];
  spawn: { position: [number, number, number]; yaw: number };
  /** player clamp bounds on the XZ plane (already inset by player radius) */
  bounds: { x0: number; z0: number; x1: number; z1: number };
}

function paintingSize(a: MuseumArtwork): { width: number; height: number } {
  const aspect = a.imageWidth / a.imageHeight;
  const long = 1.6;
  let width: number;
  let height: number;
  if (aspect >= 1) {
    width = long;
    height = width / aspect;
    if (height < 0.7) {
      // extreme panorama — let it stretch a little wider
      width = Math.min(2.4, long * 1.3);
      height = width / aspect;
    }
  } else {
    height = long;
    width = height * aspect;
  }
  if (height > 2.0) {
    height = 2.0;
    width = height * aspect;
  }
  return { width, height };
}

/**
 * One elegant rectangular room sized by painting count: north wall takes two
 * hero works, the rest split across the long east/west walls; the south wall
 * holds the (decorative) entrance door and the spawn point.
 */
export function computeGalleryLayout(artworks: MuseumArtwork[]): GalleryLayout {
  const n = artworks.length;
  const northCount = Math.min(2, n);
  const perSide = Math.ceil((n - northCount) / 2);
  const length = Math.max(12, perSide * SLOT_PITCH + 2 * CORNER_MARGIN + 2.4);
  const width = ROOM_WIDTH;

  const paintings: PaintingPlacement[] = [];
  const lights: LightPlacement[] = [];

  const place = (
    artwork: MuseumArtwork,
    wall: "north" | "east" | "west",
    offset: number, // position along the wall (centered coordinates)
  ) => {
    const { width: w, height: h } = paintingSize(artwork);
    let position: [number, number, number];
    let rotationY: number;
    let lightPos: [number, number, number];
    if (wall === "north") {
      position = [offset, PICTURE_CENTER, -length / 2 + 0.02];
      rotationY = 0;
      lightPos = [offset, WALL_HEIGHT - 0.15, -length / 2 + 1.9];
    } else if (wall === "east") {
      position = [width / 2 - 0.02, PICTURE_CENTER, offset];
      rotationY = -Math.PI / 2;
      lightPos = [width / 2 - 1.9, WALL_HEIGHT - 0.15, offset];
    } else {
      position = [-width / 2 + 0.02, PICTURE_CENTER, offset];
      rotationY = Math.PI / 2;
      lightPos = [-width / 2 + 1.9, WALL_HEIGHT - 0.15, offset];
    }
    paintings.push({ artwork, position, rotationY, width: w, height: h });
    lights.push({
      position: lightPos,
      target: [position[0], PICTURE_CENTER, position[2]],
    });
  };

  const queue = [...artworks];

  // north wall — hero works flanking the center
  if (northCount === 1) {
    place(queue.shift()!, "north", 0);
  } else if (northCount === 2) {
    place(queue.shift()!, "north", -2.1);
    place(queue.shift()!, "north", 2.1);
  }

  // long walls — evenly distributed, alternating east/west
  const east: MuseumArtwork[] = [];
  const west: MuseumArtwork[] = [];
  queue.forEach((a, i) => (i % 2 === 0 ? east : west).push(a));
  const usable = length - 2 * CORNER_MARGIN - 1.2;
  for (const [wall, list] of [
    ["east", east],
    ["west", west],
  ] as const) {
    list.forEach((a, i) => {
      const t = list.length === 1 ? 0.5 : i / (list.length - 1);
      const z = -usable / 2 + t * usable;
      place(a, wall, z);
    });
  }

  const inset = 0.55; // player radius + skin
  return {
    width,
    length,
    paintings,
    lights,
    spawn: { position: [0, EYE_HEIGHT, length / 2 - 1.7], yaw: 0 },
    bounds: {
      x0: -width / 2 + inset,
      z0: -length / 2 + inset,
      x1: width / 2 - inset,
      z1: length / 2 - inset,
    },
  };
}
