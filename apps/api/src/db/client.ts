import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { fileURLToPath } from "node:url";
import * as schema from "./schema.js";

export function createDb(url: string, authToken?: string) {
  return drizzle(createClient(authToken ? { url, authToken } : { url }), { schema });
}
export type Db = ReturnType<typeof createDb>;

export const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));

export const migrateDb = (db: Db) => migrate(db, { migrationsFolder });
