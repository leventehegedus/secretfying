import { WatchInput } from "@fdw/shared";
import { and, eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { watches } from "../db/schema.js";
import { toRow } from "./watches.js";

const SEEDS: [string, number][] = [
  ["LIS", 130],
  ["BCN", 130],
  ["LON", 120],
  ["PAR", 140],
  ["ROM", 130],
  ["ANYWHERE", 100],
];

// Idempotent: a watch with the same origin, destination and trip type is left alone.
export async function seedWatches(db: Db, now: Date): Promise<void> {
  for (const [destination, maxPrice] of SEEDS) {
    const w = WatchInput.parse({ destination, maxPrice, monthsAhead: 3, maxStops: 1 });
    const [have] = await db
      .select({ id: watches.id })
      .from(watches)
      .where(
        and(
          eq(watches.origin, w.origin),
          eq(watches.destination, w.destination),
          eq(watches.tripType, w.tripType),
        ),
      );
    if (!have) await db.insert(watches).values({ ...toRow(w), createdAt: now.toISOString() });
  }
}
