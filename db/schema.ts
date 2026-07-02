import { relations } from "drizzle-orm";
import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export interface FunFact {
  text: string;
  section: string;
  sourceTitle: string;
  revId: number | null;
}

export const periods = pgTable("periods", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  startYear: integer("start_year").notNull(),
  endYear: integer("end_year").notNull(),
  // verbatim lead extract of the movement's en-wiki article
  summary: text("summary").notNull(),
  wikipediaTitle: text("wikipedia_title").notNull(),
  wikipediaUrl: text("wikipedia_url").notNull(),
  color: text("color").notNull(),
  laneY: integer("lane_y").notNull(),
  sortOrder: integer("sort_order").notNull(),
});

export const artists = pgTable(
  "artists",
  {
    id: serial("id").primaryKey(),
    periodId: integer("period_id")
      .notNull()
      .references(() => periods.id, { onDelete: "cascade" }),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    birthYear: integer("birth_year"),
    deathYear: integer("death_year"),
    activeFrom: integer("active_from").notNull(),
    activeTo: integer("active_to").notNull(),
    // verbatim REST summary extract
    bio: text("bio").notNull(),
    wikipediaTitle: text("wikipedia_title").notNull(),
    wikipediaUrl: text("wikipedia_url").notNull(),
    wikidataId: text("wikidata_id"),
    portraitFile: text("portrait_file").notNull(),
    portraitUrl330: text("portrait_url_330").notNull(),
    portraitUrl960: text("portrait_url_960").notNull(),
    portraitWidth: integer("portrait_width").notNull(),
    portraitHeight: integer("portrait_height").notNull(),
    portraitLicense: text("portrait_license").notNull(),
    portraitLicenseUrl: text("portrait_license_url"),
    portraitAttribution: text("portrait_attribution"),
    portraitFilePageUrl: text("portrait_file_page_url").notNull(),
    yOffset: integer("y_offset").notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("artists_period_idx").on(t.periodId)],
);

export const ARTWORK_KINDS = [
  "painting",
  "sculpture",
  "public_work",
  "building",
  "photograph",
  "print",
  "fresco",
  "drawing",
] as const;
export type ArtworkKind = (typeof ARTWORK_KINDS)[number];

export const artworks = pgTable(
  "artworks",
  {
    id: serial("id").primaryKey(),
    artistId: integer("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    yearText: text("year_text"),
    year: integer("year"),
    kind: text("kind").$type<ArtworkKind>().notNull().default("painting"),
    // verbatim extract; source article recorded for provenance
    story: text("story").notNull(),
    storySourceTitle: text("story_source_title").notNull(),
    storySourceRevId: bigint("story_source_rev_id", { mode: "number" }),
    funFacts: jsonb("fun_facts").$type<FunFact[]>().notNull().default([]),
    wikipediaTitle: text("wikipedia_title"),
    wikipediaUrl: text("wikipedia_url"),
    commonsFile: text("commons_file").notNull(),
    filePageUrl: text("file_page_url").notNull(),
    imageOriginalUrl: text("image_original_url").notNull(),
    imageInspectUrl: text("image_inspect_url").notNull(),
    imageTextureUrl: text("image_texture_url").notNull(),
    imageWidth: integer("image_width").notNull(),
    imageHeight: integer("image_height").notNull(),
    license: text("license").notNull(),
    licenseUrl: text("license_url"),
    // painter for PD-Art scans; photographer for FOP photos (CC-BY requires credit)
    attribution: text("attribution").notNull(),
    credit: text("credit"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    index("artworks_artist_idx").on(t.artistId),
    uniqueIndex("artworks_artist_file_uq").on(t.artistId, t.commonsFile),
  ],
);

export const periodsRelations = relations(periods, ({ many }) => ({
  artists: many(artists),
}));

export const artistsRelations = relations(artists, ({ one, many }) => ({
  period: one(periods, {
    fields: [artists.periodId],
    references: [periods.id],
  }),
  artworks: many(artworks),
}));

export const artworksRelations = relations(artworks, ({ one }) => ({
  artist: one(artists, {
    fields: [artworks.artistId],
    references: [artists.id],
  }),
}));
