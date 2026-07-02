import { defineConfig } from "@playwright/test";

// On networks where Wikimedia is only reachable through a local proxy, the
// headless browser needs it too (system proxy settings are not inherited).
const proxyServer = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;

export default defineConfig({
  testDir: "./scripts",
  testMatch: /qa\.spec\.ts/,
  outputDir: "./qa-artifacts/results",
  timeout: 90_000,
  retries: 1,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    viewport: { width: 1440, height: 900 },
    screenshot: "only-on-failure",
    proxy: proxyServer
      ? { server: proxyServer, bypass: "localhost,127.0.0.1" }
      : undefined,
    launchOptions: {
      // headless Chrome 112+ can use the real GPU; QA_SOFT_GL=1 opts into
      // SwiftShader for machines without one (much slower)
      args: process.env.QA_SOFT_GL
        ? ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
        : ["--enable-gpu"],
    },
  },
});
