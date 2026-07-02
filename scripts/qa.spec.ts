import { expect, test, type Page } from "@playwright/test";

/**
 * QA suite for the DEPLOYED site: BASE_URL=https://… pnpm qa
 * Pointer lock is not testable headless, so the museum tests use the ?qa=1
 * seam (click-to-inspect + window.__museum hooks).
 */

declare global {
  interface Window {
    __timeline?: {
      ready: boolean;
      getTransform: () => { x: number; y: number; k: number };
      flyToArtist: (slug: string) => void;
      flyToPeriod: (slug: string) => void;
    };
    __museum?: {
      ready: boolean;
      artworkIds: number[];
      inspectPainting: (id: number) => void;
    };
  }
}

const consoleErrors: string[] = [];

function collectErrors(page: Page) {
  consoleErrors.length = 0;
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (text.includes("favicon")) return;
    if (text.includes("Failed to load resource") && text.includes("404")) return;
    consoleErrors.push(text);
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));
}

async function timelineReady(page: Page) {
  await page.waitForFunction(() => window.__timeline?.ready === true, undefined, {
    timeout: 45_000,
  });
}

test("1. timeline loads with period nebulae and the year ruler", async ({ page }) => {
  collectErrors(page);
  await page.goto("/");
  await timelineReady(page);
  const nebulae = page.locator('[data-testid^="nebula-"]');
  expect(await nebulae.count()).toBeGreaterThanOrEqual(12);
  await expect(page.getByText("Renaissance", { exact: false }).first()).toBeVisible();
  await expect(page.getByTestId("year-ruler")).toBeVisible();
  await page.screenshot({ path: "qa-artifacts/01-overview.png" });
  expect(consoleErrors, consoleErrors.join("\n")).toHaveLength(0);
});

test("2. wheel zoom changes scale and resolves artist stars (LOD)", async ({ page }) => {
  await page.goto("/");
  await timelineReady(page);
  const k0 = await page.evaluate(() => window.__timeline!.getTransform().k);
  await page.mouse.move(720, 420);
  for (let i = 0; i < 4; i++) {
    await page.mouse.wheel(0, -420);
    await page.waitForTimeout(180);
  }
  const k1 = await page.evaluate(() => window.__timeline!.getTransform().k);
  expect(k1).toBeGreaterThan(k0 * 2);
  // at least one star should now be visible (opacity > 0.5)
  await page.waitForFunction(() => {
    const stars = document.querySelectorAll('[data-testid^="star-"]');
    return Array.from(stars).some(
      (s) => Number(s.getAttribute("opacity") ?? 0) > 0.5,
    );
  });
  await page.screenshot({ path: "qa-artifacts/02-zoomed.png" });
});

test("3. filter dropdown opens, animates, and flies to a period", async ({ page }) => {
  await page.goto("/");
  await timelineReady(page);
  await page.getByTestId("filter-trigger").click();
  await expect(page.getByTestId("filter-panel")).toBeVisible();
  const options = page.locator('[data-testid^="filter-option-"]');
  expect(await options.count()).toBeGreaterThanOrEqual(13);
  const before = await page.evaluate(() => window.__timeline!.getTransform());
  await page.getByTestId("filter-option-impressionism").click();
  // camera should glide — poll until transform settles away from start
  await page.waitForFunction(
    (b) => {
      const t = window.__timeline!.getTransform();
      return Math.abs(t.k - b.k) > 0.05 || Math.abs(t.x - b.x) > 40;
    },
    before,
    { timeout: 10_000 },
  );
  await page.waitForTimeout(2200);
  // non-selected nebulae dim
  const dimmed = await page.evaluate(() => {
    const g = document.querySelector('[data-nebula-dim="baroque"]');
    return Number(g?.getAttribute("opacity") ?? 1);
  });
  expect(dimmed).toBeLessThan(0.3);
  await page.screenshot({ path: "qa-artifacts/03-filter.png" });
});

test("4. artist search opens the ivory placard card with real Wikipedia data", async ({
  page,
}) => {
  await page.goto("/");
  await timelineReady(page);
  await page.getByTestId("filter-trigger").click();
  await page.getByTestId("filter-search").fill("Monet");
  const option = page.locator('[data-testid^="filter-option-"]').first();
  await expect(option).toBeVisible();
  await option.click();
  await expect(page.getByTestId("artist-card")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("artist-card-name")).toContainText("Monet");
  await expect(page.getByTestId("artist-card")).toContainText(/18\d\d/);
  // the Wikimedia portrait actually resolves
  const naturalWidth = await page
    .getByTestId("artist-card")
    .locator("img")
    .first()
    .evaluate((img: HTMLImageElement) => img.naturalWidth);
  expect(naturalWidth).toBeGreaterThan(0);
  await page.screenshot({ path: "qa-artifacts/04-card.png" });
});

test("5. entering the museum boots WebGL with no console errors", async ({ page }) => {
  collectErrors(page);
  await page.goto("/");
  await timelineReady(page);
  await page.getByTestId("filter-trigger").click();
  await page.getByTestId("filter-search").fill("Monet");
  await page.locator('[data-testid^="filter-option-"]').first().click();
  await expect(page.getByTestId("artist-card")).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("enter-museum").click();
  await page.waitForURL(/\/museum\//, { timeout: 20_000 });
  await page.waitForFunction(() => window.__museum?.ready === true, undefined, {
    timeout: 120_000,
  });
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: "qa-artifacts/05-museum.png" });
  expect(consoleErrors, consoleErrors.join("\n")).toHaveLength(0);
});

test("6. painting inspect opens with title, story and attribution (?qa=1)", async ({
  page,
}) => {
  collectErrors(page);
  await page.goto("/");
  await timelineReady(page);
  // find a real artist slug from the timeline data
  const slug = await page.evaluate(() => {
    const star = document.querySelector('[data-testid^="star-"]');
    return star?.getAttribute("data-testid")?.replace("star-", "") ?? null;
  });
  expect(slug).toBeTruthy();
  await page.goto(`/museum/${slug}?qa=1`);
  await page.waitForFunction(() => window.__museum?.ready === true, undefined, {
    timeout: 120_000,
  });
  await page.waitForTimeout(1500);
  // museum must expose at least 8 works — the hard content requirement
  const ids = await page.evaluate(() => window.__museum!.artworkIds);
  expect(ids.length).toBeGreaterThanOrEqual(8);
  // inspect via the QA seam (raycast clicking is unreliable headless)
  await page.evaluate(() => {
    window.__museum!.inspectPainting(window.__museum!.artworkIds[0]);
  });
  await expect(page.getByTestId("painting-inspect")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("inspect-title")).not.toBeEmpty();
  await expect(page.getByTestId("painting-inspect")).toContainText(/Wikimedia Commons/);
  await page.screenshot({ path: "qa-artifacts/06-inspect.png" });
  expect(consoleErrors, consoleErrors.join("\n")).toHaveLength(0);
});
