import { loadConfig } from "../config.js";
import { createDb, migrateDb } from "./client.js";

const cfg = loadConfig(process.env);
await migrateDb(createDb(cfg.TURSO_DATABASE_URL, cfg.TURSO_AUTH_TOKEN));
