import { defineConfig } from "drizzle-kit";

// drizzle-kit does not read .env.local on its own; Node 22 can.
try {
  process.loadEnvFile(".env.local");
} catch {
  // fine when env vars are provided by the environment (CI/Vercel)
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set (expected in .env.local)");
}

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL },
});
