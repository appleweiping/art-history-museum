/** World coordinate system for the constellation timeline. */
export const WORLD_W = 8000;
export const WORLD_H = 1000;

/**
 * The year axis is piecewise linear. A linear axis gave 1200–1750 (four
 * movements) almost two thirds of the sky and squeezed the ten movements
 * after 1750 into the last quarter, where their labels piled on top of each
 * other. Each stretch below gets width roughly in proportion to how many
 * movements it holds; the ruler shows the changing scale.
 */
export const YEAR_STOPS = [1150, 1450, 1650, 1750, 1850, 1900, 1960, 2030];
export const X_STOPS = [0, 0.14, 0.26, 0.36, 0.52, 0.64, 0.84, 1].map((f) => f * WORLD_W);
export const YEAR_MIN = YEAR_STOPS[0];
export const YEAR_MAX = YEAR_STOPS[YEAR_STOPS.length - 1];

export const K_MIN = 0.15;
export const K_MAX = 20;
/**
 * The timeline opens with every century in view if that needs a zoom of at
 * least K_FIT_MIN (screens about 850 px wide and up). On narrower screens the
 * whole sky would shrink to a thin strip, so it opens at K_START_NARROW on
 * the earliest centuries instead and you drag to drift.
 */
export const K_FIT_MIN = 0.1;
export const K_START_NARROW = 0.15;

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
