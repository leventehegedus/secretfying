import { expect, it } from "vitest";
import { watches } from "../db/schema.js";
import { testDb } from "../test/db.js";
import { seedWatches } from "./seed.js";

it("is idempotent: running twice leaves the same 6 watches", async () => {
  const db = await testDb();
  const now = new Date("2026-10-30T10:00:00Z");
  await seedWatches(db, now);
  await seedWatches(db, now);
  const rows = await db.select().from(watches);
  expect(rows.map((r) => r.destination)).toEqual(["LIS", "BCN", "LON", "PAR", "ROM", "ANYWHERE"]);
  expect(rows.every((r) => r.origin === "BUD" && r.tripType === "return")).toBe(true);
});
