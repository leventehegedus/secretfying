import { DEFAULT_SETTINGS } from "@fdw/shared";
import { describe, expect, it } from "vitest";
import { deals } from "../db/schema.js";
import { NOW, testCtx } from "../providers/testkit.js";
import { insertHistory, insertWatch, obs, watch } from "../test/builders.js";
import { detectDeals } from "./detection.js";

const noFetch = (async () => new Response("{}")) as typeof fetch;
const setup = async () => {
  const { db } = await testCtx(noFetch);
  await insertWatch(db, watch({ maxPrice: 150 }));
  return db;
};
const found = (amount: number) => [
  { watch: watch({ maxPrice: 150 }), observations: [obs({ amount })] },
];

describe("detectDeals", () => {
  it("insufficient history yields only BELOW_MAX_PRICE", async () => {
    const db = await setup();
    await insertHistory(db, 5, () => 300);
    const [d] = await detectDeals(db, found(100), NOW, DEFAULT_SETTINGS);
    expect(d?.reasons).toEqual(["BELOW_MAX_PRICE"]);
    expect(d?.discountPct).toBeNull();
    expect(d?.status).toBe("candidate");
  });

  it("uses history for the median when sufficient", async () => {
    const db = await setup();
    await insertHistory(db, 14, () => 300);
    const [d] = await detectDeals(db, found(100), NOW, DEFAULT_SETTINGS);
    expect(d?.reasons).toEqual(expect.arrayContaining(["BELOW_MAX_PRICE", "BELOW_MEDIAN_PCT"]));
    expect(d?.discountPct).toBe(66.7);
  });

  it("ignores observations at or after the run start", async () => {
    const db = await setup();
    await insertHistory(db, 14, () => 300);
    const early = new Date("2026-10-01T00:00:00Z"); // all history is later than this
    const [d] = await detectDeals(db, found(100), early, DEFAULT_SETTINGS);
    expect(d?.reasons).toEqual(["BELOW_MAX_PRICE"]);
  });

  it("does not downgrade a deal verified within the cache window", async () => {
    const db = await setup();
    const [first] = await detectDeals(db, found(100), NOW, DEFAULT_SETTINGS);
    const verifiedAt = new Date(NOW.getTime() - 3_600_000).toISOString();
    await db.update(deals).set({ status: "verified", verifiedAt });
    const [again] = await detectDeals(db, found(90), NOW, DEFAULT_SETTINGS);
    expect(again).toMatchObject({ id: first?.id, status: "verified", amount: 100 });
  });
});
