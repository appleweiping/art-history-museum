import { CURATION } from "./curation";
import { buildPeriod, type PeriodResult } from "./validate";
import { stats } from "./lib/http";

const MIN_PERIODS = 12;
const MIN_ARTISTS = 3;

async function main() {
  const write = process.argv.includes("--write");
  console.log(
    `Seeding art-history-museum (${write ? "WRITE" : "dry-run"}); periods: ${CURATION.length}`,
  );

  const takenSlugs = new Set<string>();
  const results: PeriodResult[] = [];
  for (const period of CURATION) {
    console.log(`\n[${period.slug}] ${period.name} (${period.startYear}-${period.endYear})`);
    results.push(await buildPeriod(period, takenSlugs, MIN_ARTISTS));
  }

  // ---- report ----
  console.log("\n==== VALIDATION REPORT ====");
  let passPeriods = 0;
  for (const res of results) {
    const kept = res.artists.filter((a) => a.ok);
    const ok = kept.length >= MIN_ARTISTS && res.summary.length > 100;
    if (ok) passPeriods++;
    console.log(
      `${ok ? "PASS" : "FAIL"}  ${res.config.slug.padEnd(24)} artists=${kept.length}  works=${kept.reduce((n, a) => n + (a.works?.length ?? 0), 0)}`,
    );
    for (const a of res.artists) {
      if (!a.ok) console.log(`        drop ${a.config.name}: ${a.reasons[0]}`);
    }
  }
  console.log(`\nperiods passing: ${passPeriods}/${CURATION.length} (need >= ${MIN_PERIODS})`);
  console.log(`http: ${stats.network} network, ${stats.cached} cached`);

  if (passPeriods < MIN_PERIODS) {
    console.error("Thresholds not met — nothing will be written.");
    process.exit(1);
  }

  if (write) {
    const passing = results.filter(
      (r) => r.artists.filter((a) => a.ok).length >= MIN_ARTISTS && r.summary.length > 100,
    );
    const { writeAll, assertDatabase } = await import("./upsert");
    console.log(`\nWriting ${passing.length} periods to Neon...`);
    await writeAll(passing);
    await assertDatabase();
    console.log("Write complete.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
