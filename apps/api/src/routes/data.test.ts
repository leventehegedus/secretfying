import { describe, expect, it } from "vitest";
import { deals } from "../db/schema.js";
import { insertHistory, insertWatch, watch } from "../test/builders.js";
import { testApp } from "../test/app.js";

const deal = (n: number, status: "candidate" | "verified" | "stale", detectedAt: string) => ({
  watchId: 1,
  routeKey: "BUD-LIS-return",
  key: `k${n}`,
  departDate: "2026-12-05",
  returnDate: "2026-12-10",
  status,
  reasons: ["BELOW_MAX_PRICE"],
  discountPct: null,
  belowMaxPct: 10,
  amount: 100 + n,
  source: "travelpayouts",
  detectedAt,
});

describe("deals", () => {
  it("filters by status and date range", async () => {
    const { app, db } = await testApp();
    await insertWatch(db);
    await db
      .insert(deals)
      .values([
        deal(1, "verified", "2026-10-20T06:00:00.000Z"),
        deal(2, "candidate", "2026-10-25T06:00:00.000Z"),
        deal(3, "verified", "2026-10-29T06:00:00.000Z"),
      ]);
    const get = async (q: string) => (await app.inject({ url: `/api/deals?${q}` })).json();
    expect(await get("")).toHaveLength(3);
    const verified = await get("status=verified");
    expect(verified.map((d: { amount: number }) => d.amount)).toEqual([103, 101]);
    expect(verified[0]).toMatchObject({
      origin: "BUD",
      destination: "LIS",
      reasons: ["BELOW_MAX_PRICE"],
      source: "travelpayouts",
    });
    expect(await get("from=2026-10-24&to=2026-10-28")).toHaveLength(1);
    expect((await app.inject({ url: "/api/deals?status=nope" })).statusCode).toBe(400);
  });
});

describe("prices", () => {
  it("returns the series with null medians while history is insufficient", async () => {
    const { app, db } = await testApp();
    await insertWatch(db);
    await insertHistory(db, 20, (i) => 100 + i);
    const r = await app.inject({ url: "/api/watches/1/prices?range=90d" });
    const { series, stats } = r.json();
    expect(series).toHaveLength(20);
    expect(stats[0]).toMatchObject({
      median: null,
      p10: null,
      sufficiency: "insufficient_history",
    });
    expect(stats.at(-1)).toMatchObject({ sufficiency: "ok" });
    expect(stats.at(-1).median).not.toBeNull();
  });

  it("all-null stats with too few rows; 30d range cuts older rows; 404/400", async () => {
    const { app, db } = await testApp();
    await insertWatch(db);
    await insertHistory(db, 3, () => 100);
    const { stats } = (await app.inject({ url: "/api/watches/1/prices?range=365d" })).json();
    expect(stats.every((s: { median: number | null }) => s.median === null)).toBe(true);
    expect(
      (await app.inject({ url: "/api/watches/1/prices?range=30d" })).json().series,
    ).toHaveLength(3);
    expect((await app.inject({ url: "/api/watches/7/prices?range=30d" })).statusCode).toBe(404);
    expect((await app.inject({ url: "/api/watches/1/prices?range=5d" })).statusCode).toBe(400);
  });

  it("ANYWHERE watch has no series", async () => {
    const { app, db } = await testApp();
    await insertWatch(db, watch({ destination: "ANYWHERE" }));
    expect((await app.inject({ url: "/api/watches/1/prices?range=30d" })).json().series).toEqual(
      [],
    );
  });
});

describe("settings", () => {
  it("returns defaults, stores valid updates, rejects invalid", async () => {
    const { app } = await testApp();
    expect((await app.inject({ url: "/api/settings" })).json()).toMatchObject({
      minObservations: 14,
    });
    const ok = await app.inject({
      method: "PUT",
      url: "/api/settings",
      payload: { verifyTopK: 3, language: "en" },
    });
    expect(ok.json()).toMatchObject({ verifyTopK: 3, language: "en" });
    expect((await app.inject({ url: "/api/settings" })).json()).toMatchObject({ verifyTopK: 3 });
    const bad = await app.inject({
      method: "PUT",
      url: "/api/settings",
      payload: { belowMedianPct: 200 },
    });
    expect(bad.statusCode).toBe(400);
  });
});

describe("quota, providers, places", () => {
  it("reports caps per metered provider", async () => {
    const { app } = await testApp({ cap: 7 });
    expect((await app.inject({ url: "/api/quota" })).json()).toEqual({
      travelpayouts: { dayUsed: 0, dayCap: 7, monthUsed: 0, monthCap: 7 },
      serpapi: { dayUsed: 0, dayCap: 7, monthUsed: 0, monthCap: 7 },
    });
  });

  it("lists provider statuses", async () => {
    const { app } = await testApp();
    expect((await app.inject({ url: "/api/providers" })).json()).toMatchObject({
      travelpayouts: "dry_run",
      serpapi: "dry_run",
    });
  });

  it("searches places by code or name, max 10", async () => {
    const { app } = await testApp();
    const q = async (s: string) => (await app.inject({ url: `/api/places?q=${s}` })).json();
    expect(await q("lisb")).toEqual([{ code: "LIS", name: "Lisbon", kind: "city" }]);
    expect((await q("stn"))[0]).toMatchObject({ code: "STN", kind: "airport" });
    expect((await q("o")).length).toBeLessThanOrEqual(10);
    expect((await app.inject({ url: "/api/places" })).statusCode).toBe(400);
  });
});
