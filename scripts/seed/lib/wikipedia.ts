import { fetchJson } from "./http";

const REST = "https://en.wikipedia.org/api/rest_v1";
const ACTION = "https://en.wikipedia.org/w/api.php";

export interface RestSummary {
  title: string;
  displaytitle?: string;
  extract: string;
  description?: string;
  content_urls?: { desktop?: { page?: string } };
}

export async function restSummary(title: string): Promise<RestSummary | null> {
  const url = `${REST}/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}?redirect=true`;
  return fetchJson<RestSummary>(url, { allow404: true });
}

export function pageUrl(title: string): string {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
}

interface ActionQueryResponse {
  query?: {
    pages?: Array<{
      title: string;
      missing?: boolean;
      extract?: string;
      lastrevid?: number;
      pageimage?: string;
      pageprops?: { wikibase_item?: string };
    }>;
  };
}

function actionUrl(params: Record<string, string>): string {
  const qs = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    redirects: "1",
    maxlag: "5",
    ...params,
  });
  return `${ACTION}?${qs}`;
}

/** Full plaintext of an article with `== Section ==` markers, plus revision id. */
export async function plainTextArticle(
  title: string,
): Promise<{ title: string; extract: string; revId: number | null } | null> {
  const url = actionUrl({
    prop: "extracts|info",
    explaintext: "1",
    exsectionformat: "wiki",
    exlimit: "1",
    titles: title,
  });
  const res = await fetchJson<ActionQueryResponse>(url);
  const page = res?.query?.pages?.[0];
  if (!page || page.missing || !page.extract) return null;
  return { title: page.title, extract: page.extract, revId: page.lastrevid ?? null };
}

/**
 * Free-license lead image of an article ("File:..." on Commons), or null.
 * REST summary thumbnails may be fair-use local files — never use those.
 */
export async function freePageImage(title: string): Promise<string | null> {
  const url = actionUrl({
    prop: "pageimages",
    piprop: "name",
    pilicense: "free",
    titles: title,
  });
  const res = await fetchJson<ActionQueryResponse>(url);
  const name = res?.query?.pages?.[0]?.pageimage;
  return name ? `File:${name}` : null;
}

export async function wikibaseItemId(title: string): Promise<string | null> {
  const url = actionUrl({ prop: "pageprops", ppprop: "wikibase_item", titles: title });
  const res = await fetchJson<ActionQueryResponse>(url);
  return res?.query?.pages?.[0]?.pageprops?.wikibase_item ?? null;
}

interface WikidataEntityResponse {
  entities?: Record<
    string,
    {
      claims?: Record<
        string,
        Array<{
          mainsnak?: {
            datavalue?: { value?: { time?: string; [k: string]: unknown } | string };
          };
        }>
      >;
    }
  >;
}

export interface WikidataFacts {
  birthYear: number | null;
  deathYear: number | null;
  workStart: number | null;
  workEnd: number | null;
  imageFile: string | null; // P18, always a Commons file
}

function claimYear(
  entity: NonNullable<WikidataEntityResponse["entities"]>[string],
  prop: string,
): number | null {
  const value = entity.claims?.[prop]?.[0]?.mainsnak?.datavalue?.value;
  if (value && typeof value === "object" && typeof value.time === "string") {
    const m = value.time.match(/^([+-]\d{4,})/);
    if (m) return Number(m[1]);
  }
  return null;
}

export async function wikidataFacts(qid: string): Promise<WikidataFacts | null> {
  const url = `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`;
  const res = await fetchJson<WikidataEntityResponse>(url, { allow404: true });
  const entity = res?.entities?.[qid];
  if (!entity) return null;
  const image = entity.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
  return {
    birthYear: claimYear(entity, "P569"),
    deathYear: claimYear(entity, "P570"),
    workStart: claimYear(entity, "P2031"),
    workEnd: claimYear(entity, "P2032"),
    imageFile: typeof image === "string" ? `File:${image}` : null,
  };
}
