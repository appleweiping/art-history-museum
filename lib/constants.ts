/** World coordinate system for the constellation timeline. */
export const YEAR_MIN = 1000;
export const YEAR_MAX = 2030;
export const WORLD_W = 8000;
export const WORLD_H = 1000;
export const PX_PER_YEAR = WORLD_W / (YEAR_MAX - YEAR_MIN);

export const K_MIN = 0.15;
export const K_MAX = 20;

/** LOD thresholds (zoom scale k). */
export const LOD = {
  starIn: [0.5, 0.9] as const,
  nebulaFade: [0.6, 1.8] as const,
  starLabelIn: [0.9, 1.3] as const,
  dateLabelIn: [3.5, 4.5] as const,
};

/** Adaptive ruler tick steps by pixels-per-year. */
export const TICK_STEPS: Array<{ minPpy: number; major: number; minor: number }> = [
  { minPpy: 35, major: 1, minor: 0 },
  { minPpy: 15, major: 5, minor: 1 },
  { minPpy: 6, major: 10, minor: 2 },
  { minPpy: 2.5, major: 25, minor: 5 },
  { minPpy: 1.2, major: 50, minor: 10 },
  { minPpy: 0, major: 100, minor: 50 },
];

export const RULER_HEIGHT = 56;
