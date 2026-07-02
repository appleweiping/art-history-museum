import { fetchJson } from "./http";
import { stripHtml, stripQsNoise } from "./extract";

const API = "https://commons.wikimedia.org/w/api.php";

/** Wikimedia hotlink thumb whitelist — other widths return HTTP 400. */
export const ALLOWED_THUMB_WIDTHS = [250, 330, 500, 960, 1280, 1920] as const;

export interface CommonsImage {
  file: string; // normalized "File:..." title
  url: string; // original
  descriptionUrl: string; // Commons file page (attribution link)
  width: number;
  height: number;
  mime: string;
  thumbs: Partial<Record<number, string>>;
  license: string | null;
  licenseUrl: string | null;
  artist: string | null;
  credit: string | null;
  attribution: string | null;
  objectName: string | null;
  dateOriginal: string | null;
  description: string | null;
}

interface ImageInfoResponse {
  query?: {
    normalized?: Array<{ from: string; to: string }>;
    redirects?: Array<{ from: string; to: string }>;
    pages?: Array<{
      title: string;
      missing?: boolean;
      imageinfo?: Array<{
        url: string;
        descriptionurl: string;
        width: number;
        height: number;
        mime: string;
        thumburl?: string;
        thumbwidth?: number;
        extmetadata?: Record<string, { value?: string }>;
      }>;
    }>;
  };
}

function meta(
  ext: Record<string, { value?: string }> | undefined,
  key: string,
): string | null {
  const raw = ext?.[key]?.value;
  if (!raw) return null;
  const clean = stripQsNoise(stripHtml(raw)).trim();
  return clean.length > 0 ? clean : null;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Batched imageinfo lookup on Commons. Files hosted only on en-wiki (fair use)
 * come back `missing` here, which rejects them structurally.
 * One API call per requested width per batch of 50 titles (all cached).
 */
export async function imageInfoBatch(
  files: string[],
  widths: number[],
): Promise<Map<string, CommonsImage>> {
  const result = new Map<string, CommonsImage>();
  const aliases = new Map<string, string>(); // requested title -> normalized title

  for (const batch of chunk([...new Set(files)], 50)) {
    for (const width of widths) {
      const qs = new URLSearchParams({
        action: "query",
        format: "json",
        formatversion: "2",
        redirects: "1",
        maxlag: "5",
        prop: "imageinfo",
        iiprop: "url|size|mime|extmetadata",
        iiurlwidth: String(width),
        iiextmetadatafilter:
          "LicenseShortName|LicenseUrl|Artist|Credit|Attribution|ObjectName|DateTimeOriginal|ImageDescription",
        titles: batch.join("|"),
      });
      const res = await fetchJson<ImageInfoResponse>(`${API}?${qs}`);
      for (const n of res?.query?.normalized ?? []) aliases.set(n.from, n.to);
      for (const r of res?.query?.redirects ?? []) aliases.set(r.from, r.to);
      for (const page of res?.query?.pages ?? []) {
        if (page.missing || !page.imageinfo?.[0]) continue;
        const info = page.imageinfo[0];
        const existing = result.get(page.title);
        const thumbs = existing?.thumbs ?? {};
        if (info.thumburl) thumbs[width] = info.thumburl;
        if (existing) continue;
        const ext = info.extmetadata;
        result.set(page.title, {
          file: page.title,
          url: info.url,
          descriptionUrl: info.descriptionurl,
          width: info.width,
          height: info.height,
          mime: info.mime,
          thumbs,
          license: meta(ext, "LicenseShortName"),
          licenseUrl: meta(ext, "LicenseUrl"),
          artist: meta(ext, "Artist"),
          credit: meta(ext, "Credit"),
          attribution: meta(ext, "Attribution"),
          objectName: meta(ext, "ObjectName"),
          dateOriginal: meta(ext, "DateTimeOriginal"),
          description: meta(ext, "ImageDescription"),
        });
      }
    }
  }

  // let callers look up by the title they asked for
  for (const [from, to] of aliases) {
    const hit = result.get(to);
    if (hit && !result.has(from)) result.set(from, hit);
  }
  return result;
}

/** Best thumb at the requested width, falling back to original when smaller. */
export function thumbAt(img: CommonsImage, width: number): string {
  if (img.width <= width) return img.url;
  return img.thumbs[width] ?? img.url;
}

interface CategoryMembersResponse {
  continue?: { cmcontinue?: string };
  query?: { categorymembers?: Array<{ title: string }> };
}

/** Direct file members of a Commons category (paginated). */
export async function categoryFiles(
  category: string,
  max = 400,
): Promise<string[]> {
  const files: string[] = [];
  let cmcontinue: string | undefined;
  while (files.length < max) {
    const qs = new URLSearchParams({
      action: "query",
      format: "json",
      formatversion: "2",
      maxlag: "5",
      list: "categorymembers",
      cmtitle: `Category:${category}`,
      cmtype: "file",
      cmlimit: "500",
    });
    if (cmcontinue) qs.set("cmcontinue", cmcontinue);
    const res = await fetchJson<CategoryMembersResponse>(`${API}?${qs}`);
    for (const m of res?.query?.categorymembers ?? []) files.push(m.title);
    cmcontinue = res?.continue?.cmcontinue;
    if (!cmcontinue) break;
  }
  return files.slice(0, max);
}

interface SearchResponse {
  continue?: { sroffset?: number };
  query?: { search?: Array<{ title: string }> };
}

/** Files anywhere in a category tree via deepcat: search (256-subcat limit). */
export async function deepcatFiles(category: string, max = 400): Promise<string[]> {
  const files: string[] = [];
  let offset = 0;
  while (files.length < max) {
    const qs = new URLSearchParams({
      action: "query",
      format: "json",
      formatversion: "2",
      maxlag: "5",
      list: "search",
      srsearch: `deepcat:"${category}"`,
      srnamespace: "6",
      srlimit: "500",
      sroffset: String(offset),
    });
    const res = await fetchJson<SearchResponse>(`${API}?${qs}`);
    const found = res?.query?.search ?? [];
    for (const m of found) files.push(m.title);
    if (res?.continue?.sroffset == null || found.length === 0) break;
    offset = res.continue.sroffset;
  }
  return files.slice(0, max);
}
