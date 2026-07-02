import type { ArtworkKind, FunFact } from "@/db/schema";

export type { ArtworkKind, FunFact };

/** Artist node on the constellation timeline (carries card data too). */
export interface TimelineArtist {
  slug: string;
  name: string;
  birthYear: number | null;
  deathYear: number | null;
  activeFrom: number;
  activeTo: number;
  yOffset: number;
  portraitUrl330: string;
  portraitUrl960: string;
  bio: string;
  wikipediaUrl: string;
}

/** Period nebula on the constellation timeline, with its artist stars. */
export interface TimelinePeriod {
  slug: string;
  name: string;
  startYear: number;
  endYear: number;
  color: string;
  laneY: number;
  sortOrder: number;
  artists: TimelineArtist[];
}

/** Museum-placard artist card. */
export interface ArtistCardData {
  slug: string;
  name: string;
  birthYear: number | null;
  deathYear: number | null;
  bio: string;
  wikipediaUrl: string;
  portraitUrl330: string;
  portraitUrl960: string;
  periodName: string;
}

export interface MuseumArtwork {
  id: number;
  slug: string;
  title: string;
  yearText: string | null;
  year: number | null;
  kind: ArtworkKind;
  story: string;
  storySourceTitle: string;
  funFacts: FunFact[];
  wikipediaUrl: string | null;
  imageTextureUrl: string;
  imageInspectUrl: string;
  imageOriginalUrl: string;
  imageWidth: number;
  imageHeight: number;
  license: string;
  licenseUrl: string | null;
  attribution: string;
  filePageUrl: string;
}

export interface MuseumData {
  artist: {
    slug: string;
    name: string;
    birthYear: number | null;
    deathYear: number | null;
    bio: string;
    wikipediaUrl: string;
    periodName: string;
    periodSlug: string;
  };
  artworks: MuseumArtwork[];
}
