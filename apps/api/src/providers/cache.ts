import { and, eq, gt } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { providerCache } from "../db/schema.js";
import type { Cache } from "./types.js";

export function createCache(db: Db, now: () => Date): Cache {
  return {
    async get(key) {
      const [row] = await db
        .select({ json: providerCache.json })
        .from(providerCache)
        .where(and(eq(providerCache.key, key), gt(providerCache.expiresAt, now().toISOString())));
      return row?.json;
    },
    async set(key, value, ttlMs) {
      const expiresAt = new Date(now().getTime() + ttlMs).toISOString();
      await db
        .insert(providerCache)
        .values({ key, json: value, expiresAt })
        .onConflictDoUpdate({ target: providerCache.key, set: { json: value, expiresAt } });
    },
  };
}
