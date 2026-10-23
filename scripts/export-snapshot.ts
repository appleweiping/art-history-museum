/**
 * Dump the collection from Postgres into data/collection.json, the snapshot
 * the app falls back to when DATABASE_URL is not set.
 *
 *   pnpm snapshot        (reads DATABASE_URL from .env.local)
 */
import { writeFile } from "node:fs/promises";
import { getAllArtistSlugs, getMuseum, getTimeline } from "@/lib/queries";
import { SNAPSHOT_PATH, type CollectionSnapshot } from "@/lib/collection";
import type { MuseumData } from "@/lib/types";

async function main() {
  const periods = await getTimeline();
  const museums: Record<string, MuseumData> = {};
  for (const slug of await getAllArtistSlugs()) {
    const museum = await getMuseum(slug);
    if (museum && museum.artworks.length > 0) museums[slug] = museum;
  }
  const snapshot: CollectionSnapshot = { periods, museums };
  await writeFile(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 1) + "\n");
  const works = Object.values(museums).reduce((n, m) => n + m.artworks.length, 0);
  console.log(
    `wrote ${SNAPSHOT_PATH}: ${periods.length} periods, ${Object.keys(museums).length} artists, ${works} works`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
