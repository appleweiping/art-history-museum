import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fetch as undiciFetch, ProxyAgent } from "undici";

// Node's built-in fetch ignores HTTP(S)_PROXY; on networks where Wikimedia is
// only reachable through a local proxy we must route explicitly.
const PROXY_URL = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || "";
const dispatcher = PROXY_URL ? new ProxyAgent(PROXY_URL) : undefined;

const CACHE_DIR = path.join(process.cwd(), ".cache", "wiki");
const USER_AGENT =
  "ArtHistoryMuseum-Seed/1.0 (https://art-history-museum.vercel.app; BensonHalefdo@theplate.com)";
const GAP_MS = 120;
const MAX_RETRIES = 5;

export const stats = { network: 0, cached: 0 };

const refresh = process.argv.includes("--refresh");

let chain: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Serialize all live API calls with a polite gap between them. */
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(async () => {
    const wait = lastRequestAt + GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    try {
      return await fn();
    } finally {
      lastRequestAt = Date.now();
    }
  });
  chain = next.catch(() => {});
  return next;
}

function cachePath(url: string) {
  const sha = createHash("sha1").update(url).digest("hex");
  return path.join(CACHE_DIR, `${sha}.json`);
}

async function fetchWithRetry(url: string): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await undiciFetch(url, {
        headers: { "user-agent": USER_AGENT, accept: "application/json" },
        dispatcher,
      });
      if (res.status === 429 || res.status === 503 || res.status >= 500) {
        const retryAfter = Number(res.headers.get("retry-after"));
        const backoff = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : 1000 * 2 ** attempt;
        await sleep(backoff);
        lastError = new Error(`HTTP ${res.status} for ${url}`);
        continue;
      }
      return res;
    } catch (err) {
      lastError = err;
      await sleep(1000 * 2 ** attempt);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export interface FetchJsonOptions {
  /** Return null instead of throwing on 404. */
  allow404?: boolean;
}

export async function fetchJson<T>(
  url: string,
  { allow404 = false }: FetchJsonOptions = {},
): Promise<T | null> {
  const file = cachePath(url);
  if (!refresh && existsSync(file)) {
    stats.cached++;
    const cached = JSON.parse(readFileSync(file, "utf8")) as {
      status: number;
      body: T | null;
    };
    if (cached.status === 404) {
      if (allow404) return null;
      throw new Error(`HTTP 404 (cached) for ${url}`);
    }
    return cached.body;
  }

  return enqueue(async () => {
    const res = await fetchWithRetry(url);
    stats.network++;
    if (res.status === 404) {
      mkdirSync(CACHE_DIR, { recursive: true });
      writeFileSync(file, JSON.stringify({ status: 404, body: null }));
      if (allow404) return null;
      throw new Error(`HTTP 404 for ${url}`);
    }
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for ${url}`);
    }
    const body = (await res.json()) as T;
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(file, JSON.stringify({ status: res.status, body }));
    return body;
  });
}

/** HEAD-check a URL (used by spot checks); not cached, light concurrency. */
export async function headOk(url: string): Promise<{ ok: boolean; status: number }> {
  try {
    const res = await undiciFetch(url, {
      method: "HEAD",
      headers: { "user-agent": USER_AGENT },
      dispatcher,
    });
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  }
}
