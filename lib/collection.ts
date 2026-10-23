import { readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import type { ArtistCardData, MuseumData, TimelinePeriod } from "./types";

/**
 * Where the pages get their data from. With DATABASE_URL set (production, or
 * after `pnpm seed --write`) everything comes from Postgres; without it the
 * app falls back to data/collection.json, a snapshot of the same collection,
 * so a fresh clone runs with no database at all.
 */
export interface CollectionSnapshot {
  periods: TimelinePeriod[];
  museums: Record<string, MuseumData>;
}

export const SNAPSHOT_PATH = path.join(process.cwd(), "data", "collection.json");

const useDatabase = Boolean(process.env.DATABASE_URL);

const loadSnapshot = cache(async (): Promise<CollectionSnapshot> => {
  return JSON.parse(await readFile(SNAPSHOT_PATH, "utf8")) as CollectionSnapshot;
});

export const getTimeline = cache(async (): Promise<TimelinePeriod[]> => {
  if (useDatabase) return (await import("./queries")).getTimeline();
  return (await loadSnapshot()).periods;
});

export const getArtistCard = cache(
  async (slug: string): Promise<ArtistCardData | null> => {
    if (useDatabase) return (await import("./queries")).getArtistCard(slug);
    const museum = (await loadSnapshot()).museums[slug];
    if (!museum) return null;
    const periods = (await loadSnapshot()).periods;
    const artist = periods
      .flatMap((p) => p.artists)
      .find((a) => a.slug === slug);
    return {
      slug,
      name: museum.artist.name,
      birthYear: museum.artist.birthYear,
      deathYear: museum.artist.deathYear,
      bio: museum.artist.bio,
      wikipediaUrl: museum.artist.wikipediaUrl,
      portraitUrl330: artist?.portraitUrl330 ?? "",
      portraitUrl960: artist?.portraitUrl960 ?? "",
      periodName: museum.artist.periodName,
    };
  },
);

export const getMuseum = cache(async (slug: string): Promise<MuseumData | null> => {
  if (useDatabase) return (await import("./queries")).getMuseum(slug);
  return (await loadSnapshot()).museums[slug] ?? null;
});

export const getAllArtistSlugs = cache(async (): Promise<string[]> => {
  if (useDatabase) return (await import("./queries")).getAllArtistSlugs();
  return Object.keys((await loadSnapshot()).museums);
});
