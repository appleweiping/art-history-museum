import type { ArtworkKind, FunFact } from "../../db/schema";
import type { CurationArtist, CurationPeriod } from "./types";
import {
  categoryFiles,
  deepcatFiles,
  imageInfoBatch,
  thumbAt,
  type CommonsImage,
} from "./lib/commons";
import {
  freePageImage,
  pageUrl,
  plainTextArticle,
  restSummary,
  wikibaseItemId,
  wikidataFacts,
} from "./lib/wikipedia";
import {
  pickFunFacts,
  splitSections,
  splitSentences,
  titleFromFileName,
  trimStory,
  yearFromString,
} from "./lib/extract";
import { uniqueSlug } from "./lib/slug";

export const LICENSE_ALLOW =
  /^(public domain|pd\b|no restrictions|cc0|cc[ -]by(?:[ -]sa)?\b|attribution)/i;

const CURRENT_YEAR = 2026;
const MIN_WORKS = 8;
const MAX_WORKS = 14;
const MIN_LONG_SIDE = 600;

/** Filename noise that is never a reproduction of the artist's work. */
const NOISE =
  /\b(exhibitions?|exhibits?|vernissage|visitors?|besucher|ausstellung|signature|autograph|grave|tomb|tombstone|plaque|poster|catalogue|catalog|bookcover|documenta|screenshot)\b/i;

export interface WorkRow {
  slug: string;
  title: string;
  yearText: string | null;
  year: number | null;
  kind: ArtworkKind;
  story: string;
  storySourceTitle: string;
  storySourceRevId: number | null;
  funFacts: FunFact[];
  wikipediaTitle: string | null;
  wikipediaUrl: string | null;
  commonsFile: string;
  filePageUrl: string;
  imageOriginalUrl: string;
  imageInspectUrl: string;
  imageTextureUrl: string;
  imageWidth: number;
  imageHeight: number;
  license: string;
  licenseUrl: string | null;
  attribution: string;
  credit: string | null;
  sortOrder: number;
}

export interface ArtistRow {
  slug: string;
  name: string;
  birthYear: number | null;
  deathYear: number | null;
  activeFrom: number;
  activeTo: number;
  bio: string;
  wikipediaTitle: string;
  wikipediaUrl: string;
  wikidataId: string | null;
  portraitFile: string;
  portraitUrl330: string;
  portraitUrl960: string;
  portraitWidth: number;
  portraitHeight: number;
  portraitLicense: string;
  portraitLicenseUrl: string | null;
  portraitAttribution: string | null;
  portraitFilePageUrl: string;
  sortOrder: number;
}

export interface ArtistResult {
  config: CurationArtist;
  ok: boolean;
  reasons: string[];
  artist?: ArtistRow;
  works?: WorkRow[];
}

export interface PeriodResult {
  config: CurationPeriod;
  summary: string;
  wikipediaUrl: string;
  artists: ArtistResult[];
}

function isCommonsHosted(img: CommonsImage): boolean {
  return img.url.includes("/wikipedia/commons/");
}

function licenseOk(img: CommonsImage): boolean {
  return img.license != null && LICENSE_ALLOW.test(img.license);
}

function workImageOk(img: CommonsImage): string | null {
  if (!isCommonsHosted(img)) return "not Commons-hosted";
  if (!/^image\/(jpeg|png)$/.test(img.mime)) return `mime ${img.mime}`;
  if (!licenseOk(img)) return `license ${img.license ?? "unknown"}`;
  const long = Math.max(img.width, img.height);
  if (long < MIN_LONG_SIDE) return `too small (${img.width}x${img.height})`;
  const aspect = img.width / img.height;
  if (aspect < 0.25 || aspect > 4) return `extreme aspect ${aspect.toFixed(2)}`;
  return null;
}

interface Candidate {
  fromArticle: boolean;
  articleTitle: string | null;
  title: string;
  year: number | null;
  yearText: string | null;
  story: string;
  storySourceTitle: string;
  storySourceRevId: number | null;
  funFacts: FunFact[];
  img: CommonsImage;
}

export async function buildArtist(
  config: CurationArtist,
  period: CurationPeriod,
  takenSlugs: Set<string>,
  sortOrder: number,
): Promise<ArtistResult> {
  const reasons: string[] = [];

  // 1. Biography (verbatim REST summary lead).
  const summary = await restSummary(config.wikipediaTitle);
  if (!summary || !summary.extract || summary.extract.length < 200) {
    return { config, ok: false, reasons: ["missing/short en-wiki summary"] };
  }
  const normalizedTitle = summary.title;

  // 2. Dates from Wikidata (fallbacks keep the timeline deterministic).
  const qid = await wikibaseItemId(normalizedTitle);
  const facts = qid ? await wikidataFacts(qid) : null;
  const birthYear = facts?.birthYear ?? null;
  const deathYear = facts?.deathYear ?? null;
  const activeFrom =
    facts?.workStart ?? (birthYear != null ? birthYear + 20 : period.startYear);
  const activeTo =
    facts?.workEnd ??
    deathYear ??
    (birthYear != null && CURRENT_YEAR - birthYear < 100
      ? Math.min(CURRENT_YEAR, period.endYear + 20)
      : period.endYear);

  // 3. Portrait — free page image first, Wikidata P18 (always Commons) as fallback.
  let portrait: CommonsImage | null = null;
  const portraitCandidates = [
    await freePageImage(normalizedTitle),
    facts?.imageFile ?? null,
  ].filter((f): f is string => Boolean(f));
  if (portraitCandidates.length > 0) {
    const infos = await imageInfoBatch(portraitCandidates, [330, 960]);
    for (const file of portraitCandidates) {
      const img = infos.get(file);
      if (img && isCommonsHosted(img) && licenseOk(img) && Math.max(img.width, img.height) >= 250) {
        portrait = img;
        break;
      }
    }
  }
  if (!portrait) {
    return { config, ok: false, reasons: ["no free Commons portrait"] };
  }

  // Artist-article sections fuel fallback facts for category-sourced works.
  const artistArticle = await plainTextArticle(normalizedTitle);
  const artistSections = artistArticle ? splitSections(artistArticle.extract) : [];
  const artistFacts = artistArticle
    ? pickFunFacts(artistSections, artistArticle.title, artistArticle.revId, 2)
    : [];
  const bioFallbackStory = splitSentences(summary.extract).slice(0, 3).join(" ");

  const candidates: Candidate[] = [];
  const usedFiles = new Set<string>([portrait.file]);

  // 4a. Works with their own Wikipedia article: image + story + facts all tied together.
  for (const workTitle of config.workArticles.slice(0, 14)) {
    const ws = await restSummary(workTitle);
    if (!ws || !ws.extract || ws.extract.length < 100) {
      reasons.push(`work "${workTitle}": no usable article`);
      continue;
    }
    const imgFile = await freePageImage(ws.title);
    if (!imgFile) {
      reasons.push(`work "${workTitle}": no free lead image`);
      continue;
    }
    const infos = await imageInfoBatch([imgFile], [960, 1920]);
    const img = infos.get(imgFile);
    if (!img) {
      reasons.push(`work "${workTitle}": image missing on Commons`);
      continue;
    }
    const problem = workImageOk(img);
    if (problem) {
      reasons.push(`work "${workTitle}": ${problem}`);
      continue;
    }
    if (usedFiles.has(img.file)) continue;
    usedFiles.add(img.file);

    const full = await plainTextArticle(ws.title);
    const funFacts = full
      ? pickFunFacts(splitSections(full.extract), full.title, full.revId, 4)
      : [];
    const year =
      yearFromString(ws.description) ??
      yearFromString(splitSentences(ws.extract).slice(0, 2).join(" ")) ??
      yearFromString(img.dateOriginal);
    candidates.push({
      fromArticle: true,
      articleTitle: ws.title,
      title: ws.title.replace(/\s+\([^)]*\)$/, ""),
      year,
      yearText: year != null ? String(year) : null,
      story: trimStory(ws.extract),
      storySourceTitle: ws.title,
      storySourceRevId: full?.revId ?? null,
      funFacts,
      img,
    });
  }

  // 4b. Fill from Commons categories (and explicit preferred files).
  if (candidates.length < MAX_WORKS) {
    const files: string[] = [...(config.preferredFiles ?? [])];
    for (const cat of config.commonsCategories) {
      try {
        files.push(...(await categoryFiles(cat, 250)));
        if (config.deepCategories) files.push(...(await deepcatFiles(cat, 250)));
      } catch (err) {
        reasons.push(`category "${cat}": ${err instanceof Error ? err.message : err}`);
      }
    }
    const fresh = [...new Set(files)]
      .filter((f) => !usedFiles.has(f) && !NOISE.test(f))
      .slice(0, 300);
    const infos = await imageInfoBatch(fresh, [960, 1920]);
    const scored: Array<{ img: CommonsImage }> = [];
    const seenNormalized = new Set<string>();
    for (const file of fresh) {
      const img = infos.get(file);
      if (!img || usedFiles.has(img.file) || seenNormalized.has(img.file)) continue;
      seenNormalized.add(img.file);
      if (workImageOk(img)) continue;
      if (img.objectName && NOISE.test(img.objectName)) continue;
      scored.push({ img });
    }
    scored.sort((a, b) => b.img.width * b.img.height - a.img.width * a.img.height);
    for (const { img } of scored) {
      if (candidates.length >= MAX_WORKS) break;
      usedFiles.add(img.file);
      const title = img.objectName ?? titleFromFileName(img.file);
      const year = yearFromString(img.dateOriginal) ?? yearFromString(title);
      const description = img.description ?? "";
      const useDescription = description.length >= 120;
      candidates.push({
        fromArticle: false,
        articleTitle: null,
        title,
        year,
        yearText: year != null ? String(year) : (img.dateOriginal?.slice(0, 24) ?? null),
        story: useDescription ? trimStory(description) : bioFallbackStory,
        storySourceTitle: useDescription ? img.file : normalizedTitle,
        storySourceRevId: null,
        funFacts: artistFacts,
        img,
      });
    }
  }

  if (candidates.length < MIN_WORKS) {
    return {
      config,
      ok: false,
      reasons: [`only ${candidates.length}/${MIN_WORKS} works passed`, ...reasons],
    };
  }

  // Article-backed works first (they carry real stories), then by resolution.
  candidates.sort((a, b) => {
    if (a.fromArticle !== b.fromArticle) return a.fromArticle ? -1 : 1;
    return b.img.width * b.img.height - a.img.width * a.img.height;
  });

  const artistSlug = uniqueSlug(config.name, null, takenSlugs);
  const works: WorkRow[] = candidates.slice(0, MAX_WORKS).map((c, i) => ({
    slug: uniqueSlug(`${config.name} ${c.title}`, c.year, takenSlugs),
    title: c.title,
    yearText: c.yearText,
    year: c.year,
    kind: config.kindDefault ?? "painting",
    story: c.story,
    storySourceTitle: c.storySourceTitle,
    storySourceRevId: c.storySourceRevId,
    funFacts: c.funFacts,
    wikipediaTitle: c.articleTitle,
    wikipediaUrl: c.articleTitle ? pageUrl(c.articleTitle) : null,
    commonsFile: c.img.file,
    filePageUrl: c.img.descriptionUrl,
    imageOriginalUrl: c.img.url,
    imageInspectUrl: thumbAt(c.img, 1920),
    imageTextureUrl: thumbAt(c.img, 960),
    imageWidth: c.img.width,
    imageHeight: c.img.height,
    license: c.img.license ?? "unknown",
    licenseUrl: c.img.licenseUrl,
    attribution: c.img.artist ?? c.img.attribution ?? c.img.credit ?? "Wikimedia Commons",
    credit: c.img.credit,
    sortOrder: i,
  }));

  return {
    config,
    ok: true,
    reasons,
    artist: {
      slug: artistSlug,
      name: config.name,
      birthYear,
      deathYear,
      activeFrom,
      activeTo,
      bio: summary.extract,
      wikipediaTitle: normalizedTitle,
      wikipediaUrl: summary.content_urls?.desktop?.page ?? pageUrl(normalizedTitle),
      wikidataId: qid,
      portraitFile: portrait.file,
      portraitUrl330: thumbAt(portrait, 330),
      portraitUrl960: thumbAt(portrait, 960),
      portraitWidth: portrait.width,
      portraitHeight: portrait.height,
      portraitLicense: portrait.license ?? "unknown",
      portraitLicenseUrl: portrait.licenseUrl,
      portraitAttribution: portrait.artist ?? portrait.attribution,
      portraitFilePageUrl: portrait.descriptionUrl,
      sortOrder,
    },
    works,
  };
}

export async function buildPeriod(
  config: CurationPeriod,
  takenSlugs: Set<string>,
  minArtists = 3,
  maxArtists = 4,
): Promise<PeriodResult> {
  const movement = await restSummary(config.wikipediaTitle);
  const artists: ArtistResult[] = [];
  let kept = 0;
  const ranked = [...config.artists].sort((a, b) => a.rank - b.rank);
  for (const artistConfig of ranked) {
    if (kept >= maxArtists) break;
    const result = await buildArtist(artistConfig, config, takenSlugs, kept);
    artists.push(result);
    if (result.ok) kept++;
    const label = result.ok
      ? `OK  (${result.works?.length} works)`
      : `FAIL(${result.reasons[0]})`;
    console.log(`    ${artistConfig.name.padEnd(32)} ${label}`);
  }
  if (kept < minArtists) {
    console.warn(`  !! period ${config.slug}: only ${kept}/${minArtists} artists passed`);
  }
  return {
    config,
    summary: movement?.extract ?? "",
    wikipediaUrl: movement?.content_urls?.desktop?.page ?? pageUrl(config.wikipediaTitle),
    artists,
  };
}
