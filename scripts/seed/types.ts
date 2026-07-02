import type { ArtworkKind } from "../../db/schema";

export interface CurationArtist {
  name: string;
  /** Exact en-wiki article title. */
  wikipediaTitle: string;
  /** 1 = primary pick; higher = substitute, used only to backfill a period. */
  rank: number;
  /** Commons categories of their WORKS, without the "Category:" prefix. */
  commonsCategories: string[];
  /** en-wiki article titles of individual works (best first). */
  workArticles: string[];
  /** Explicit "File:..." overrides, tried before category scraping. */
  preferredFiles?: string[];
  /** Default artwork kind when not derivable (paintings vs FOP sculpture photos). */
  kindDefault?: ArtworkKind;
  /** Category tree is per-work/per-year subcats — use deepcat search too. */
  deepCategories?: boolean;
  notes?: string;
}

export interface CurationPeriod {
  slug: string;
  name: string;
  /** Exact en-wiki article title of the movement. */
  wikipediaTitle: string;
  startYear: number;
  endYear: number;
  /** Nebula hue for the timeline. */
  color: string;
  /** Timeline lane (world-space y). */
  laneY: number;
  artists: CurationArtist[];
}
