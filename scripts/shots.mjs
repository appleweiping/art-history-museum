// One-off visual verification: node scripts/shots.mjs [baseUrl]
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:3100";
const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;

// headless with the REAL GPU (Chrome 112+): no swiftshader flags
const browser = await chromium.launch({
  args: ["--enable-gpu"],
  proxy: proxy ? { server: proxy, bypass: "localhost,127.0.0.1" } : undefined,
});
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });

console.log("museum…");
await page.goto(`${base}/museum/claude-monet?qa=1`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__museum?.ready === true, null, { timeout: 240_000 });
// let the software rasterizer push several full frames
await page.waitForTimeout(15_000);
await page.screenshot({ path: "qa-artifacts/live-museum.png" });

console.log("inspect…");
await page.evaluate(() => window.__museum.inspectPainting(window.__museum.artworkIds[0]));
await page.waitForTimeout(2_500);
await page.screenshot({ path: "qa-artifacts/live-inspect.png" });

console.log("timeline…");
await page.goto(`${base}/#impressionism`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__timeline?.ready === true, null, { timeout: 60_000 });
await page.waitForTimeout(4_000);
await page.screenshot({ path: "qa-artifacts/live-timeline-focus.png" });

await browser.close();
console.log("done");
