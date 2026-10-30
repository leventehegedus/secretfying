import { defineConfig } from "drizzle-kit";
import { loadConfig } from "./src/config.js";

const cfg = loadConfig(process.env);

export default defineConfig({
  dialect: "turso",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: cfg.TURSO_DATABASE_URL, authToken: cfg.TURSO_AUTH_TOKEN },
});
