import { cache } from "react";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { artists, artworks } from "@/db/schema";
import type { ArtistCardData, MuseumData, TimelinePeriod } from "./types";

/** All periods with their artist stars — feeds the constellation timeline. */
export const getTimeline = cache(async (): Promise<TimelinePeriod[]> => {
  const rows = await db.query.periods.findMany({
    orderBy: (p, { asc: a }) => [a(p.sortOrder)],
    with: {
      artists: {
        orderBy: [asc(artists.sortOrder)],
        columns: {
          slug: true,
          name: true,
          birthYear: true,
          deathYear: true,
          activeFrom: true,
          activeTo: true,
          yOffset: true,
          portraitUrl330: true,
          portraitUrl960: true,
          bio: true,
          wikipediaUrl: true,
        },
      },
    },
  });
  return rows.map((p) => ({
    slug: p.slug,
    name: p.name,
    startYear: p.startYear,
    endYear: p.endYear,
    color: p.color,
    laneY: p.laneY,
    sortOrder: p.sortOrder,
    artists: p.artists,
  }));
});

export const getArtistCard = cache(
  async (slug: string): Promise<ArtistCardData | null> => {
    const row = await db.query.artists.findFirst({
      where: eq(artists.slug, slug),
      with: { period: { columns: { name: true } } },
    });
    if (!row) return null;
    return {
      slug: row.slug,
      name: row.name,
      birthYear: row.birthYear,
      deathYear: row.deathYear,
      bio: row.bio,
      wikipediaUrl: row.wikipediaUrl,
      portraitUrl330: row.portraitUrl330,
      portraitUrl960: row.portraitUrl960,
      periodName: row.period.name,
    };
  },
);

export const getMuseum = cache(async (slug: string): Promise<MuseumData | null> => {
  const row = await db.query.artists.findFirst({
    where: eq(artists.slug, slug),
    with: {
      period: { columns: { name: true, slug: true } },
      artworks: { orderBy: [asc(artworks.sortOrder)] },
    },
  });
  if (!row) return null;
  return {
    artist: {
      slug: row.slug,
      name: row.name,
      birthYear: row.birthYear,
      deathYear: row.deathYear,
      bio: row.bio,
      wikipediaUrl: row.wikipediaUrl,
      periodName: row.period.name,
      periodSlug: row.period.slug,
    },
    artworks: row.artworks.map((w) => ({
      id: w.id,
      slug: w.slug,
      title: w.title,
      yearText: w.yearText,
      year: w.year,
      kind: w.kind,
      story: w.story,
      storySourceTitle: w.storySourceTitle,
      funFacts: w.funFacts,
      wikipediaUrl: w.wikipediaUrl,
      imageTextureUrl: w.imageTextureUrl,
      imageInspectUrl: w.imageInspectUrl,
      imageOriginalUrl: w.imageOriginalUrl,
      imageWidth: w.imageWidth,
      imageHeight: w.imageHeight,
      license: w.license,
      licenseUrl: w.licenseUrl,
      attribution: w.attribution,
      filePageUrl: w.filePageUrl,
    })),
  };
});

/** Slugs for generateStaticParams on /museum/[slug]. */
export const getAllArtistSlugs = cache(async (): Promise<string[]> => {
  const rows = await db.query.artists.findMany({ columns: { slug: true } });
  return rows.map((r) => r.slug);
});
