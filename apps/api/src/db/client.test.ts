import { getTableName } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { testDb } from "../test/db.js";
import { observationKey } from "./keys.js";
import { observations } from "./schema.js";
import * as schema from "./schema.js";

const row = {
  source: "fixture",
  isCached: true,
  observedAt: "2026-10-30T07:00:00Z",
  observedDay: "2026-10-30",
  currency: "EUR",
  amount: 50,
  origin: "BUD",
  destination: "LIS",
  departDate: "2026-12-01",
  returnDate: "2026-12-08",
  stops: 0,
};
const withKey = (r: typeof row | (Omit<typeof row, "returnDate"> & { returnDate: null })) => ({
  ...r,
  key: observationKey(r),
});

describe("db", () => {
  it("migrates all 8 tables", async () => {
    const db = await testDb();
    const rows = await db.all<{ name: string }>(
      sql`select name from sqlite_master where type='table' and name not like '%drizzle%' and name not like 'sqlite_%'`,
    );
    const expected = Object.values(schema).map((t) => getTableName(t));
    expect(rows.map((r) => r.name).sort()).toEqual(expected.sort());
    expect(expected).toHaveLength(8);
  });

  it("rejects a duplicate same-day observation", async () => {
    const db = await testDb();
    await db.insert(observations).values(withKey(row));
    await expect(db.insert(observations).values(withKey(row))).rejects.toThrow();
  });

  it("rejects a duplicate same-day one-way observation (null returnDate)", async () => {
    const db = await testDb();
    const oneWay = withKey({ ...row, returnDate: null });
    await db.insert(observations).values(oneWay);
    await expect(db.insert(observations).values(oneWay)).rejects.toThrow();
  });
});
