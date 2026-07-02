import { and, eq, notInArray } from "drizzle-orm";
import type { PeriodResult } from "./validate";

/**
 * Idempotent write of validated results into Neon. Imported lazily so dry runs
 * never require DATABASE_URL.
 */
export async function writeAll(results: PeriodResult[]): Promise<void> {
  const { db } = await import("../../db");
  const { periods, artists, artworks } = await import("../../db/schema");

  const keptPeriodSlugs: string[] = [];
  const keptArtistSlugs: string[] = [];

  for (let p = 0; p < results.length; p++) {
    const res = results[p];
    const periodValues = {
      slug: res.config.slug,
      name: res.config.name,
      startYear: res.config.startYear,
      endYear: res.config.endYear,
      summary: res.summary,
      wikipediaTitle: res.config.wikipediaTitle,
      wikipediaUrl: res.wikipediaUrl,
      color: res.config.color,
      laneY: res.config.laneY,
      sortOrder: p,
    };
    const [periodRow] = await db
      .insert(periods)
      .values(periodValues)
      .onConflictDoUpdate({ target: periods.slug, set: periodValues })
      .returning({ id: periods.id });
    keptPeriodSlugs.push(res.config.slug);

    for (const a of res.artists) {
      if (!a.ok || !a.artist || !a.works) continue;
      const artistValues = { ...a.artist, periodId: periodRow.id };
      const [artistRow] = await db
        .insert(artists)
        .values(artistValues)
        .onConflictDoUpdate({ target: artists.slug, set: artistValues })
        .returning({ id: artists.id });
      keptArtistSlugs.push(a.artist.slug);

      const workSlugs: string[] = [];
      for (const w of a.works) {
        const workValues = { ...w, artistId: artistRow.id };
        await db
          .insert(artworks)
          .values(workValues)
          .onConflictDoUpdate({ target: artworks.slug, set: workValues });
        workSlugs.push(w.slug);
      }
      // prune works dropped since the last seed run
      await db
        .delete(artworks)
        .where(
          and(eq(artworks.artistId, artistRow.id), notInArray(artworks.slug, workSlugs)),
        );
    }
  }

  // prune artists/periods no longer curated (cascades to their artworks)
  if (keptArtistSlugs.length > 0) {
    await db.delete(artists).where(notInArray(artists.slug, keptArtistSlugs));
  }
  if (keptPeriodSlugs.length > 0) {
    await db.delete(periods).where(notInArray(periods.slug, keptPeriodSlugs));
  }
}

/** Post-write sanity assertions (thresholds + provenance invariants). */
export async function assertDatabase(): Promise<void> {
  const { db } = await import("../../db");
  const { sql } = await import("drizzle-orm");

  const rows = await db.execute(sql`
    SELECT
      (SELECT count(*) FROM periods) AS periods,
      (SELECT count(*) FROM artists) AS artists,
      (SELECT min(c) FROM (SELECT count(*) c FROM artists GROUP BY period_id) t) AS min_artists_per_period,
      (SELECT count(*) FROM artworks) AS artworks,
      (SELECT min(c) FROM (SELECT count(*) c FROM artworks GROUP BY artist_id) t) AS min_works_per_artist,
      (SELECT count(*) FROM artworks WHERE image_texture_url NOT LIKE '%/wikipedia/commons/%') AS non_commons,
      (SELECT count(*) FROM artworks WHERE attribution = '' ) AS empty_attribution
  `);
  const r = (rows as unknown as { rows: Record<string, unknown>[] }).rows?.[0] ??
    (rows as unknown as Record<string, unknown>[])[0];
  console.log("DB assertions:", r);
  const num = (v: unknown) => Number(v ?? 0);
  if (num(r.periods) < 12) throw new Error(`periods ${r.periods} < 12`);
  if (num(r.min_artists_per_period) < 3)
    throw new Error(`a period has ${r.min_artists_per_period} artists (<3)`);
  if (num(r.min_works_per_artist) < 8)
    throw new Error(`an artist has ${r.min_works_per_artist} works (<8)`);
  if (num(r.non_commons) > 0) throw new Error(`${r.non_commons} non-Commons texture URLs`);
  if (num(r.empty_attribution) > 0) throw new Error(`${r.empty_attribution} empty attributions`);
}
