import { DEFAULT_SETTINGS } from "@fdw/shared";
import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { deals, observations } from "../db/schema.js";
import type { FlightPriceProvider, ProviderResult } from "../providers/types.js";
import { testCtx } from "../providers/testkit.js";
import { insertWatch, obs, watch } from "../test/builders.js";
import { detectDeals } from "./detection.js";
import { verifyTopDeals } from "./verification.js";

const W = watch({ maxPrice: 150 });
const noFetch = (async () => new Response("{}")) as typeof fetch;
const fake = (id: "travelpayouts" | "serpapi", r: ProviderResult): FlightPriceProvider => ({
  id,
  verify: vi.fn(async () => r),
});
const live = (amount: number): ProviderResult => ({
  ok: true,
  observations: [obs({ source: "serpapi", isCached: false, amount })],
  dropped: 0,
});

async function setup(amounts: number[]) {
  const t = await testCtx(noFetch);
  await insertWatch(t.db, W);
  const rows = await detectDeals(
    t.db,
    [
      {
        watch: W,
        observations: amounts.map((a, i) =>
          obs({ amount: a, departDate: `2026-12-0${i + 1}`, returnDate: `2026-12-1${i}` }),
        ),
      },
    ],
    t.ctx.now(),
    DEFAULT_SETTINGS,
  );
  return { ...t, rows };
}

describe("verifyTopDeals", () => {
  it("verifies only the top K and stores the live observation", async () => {
    const { db, ctx, rows } = await setup([90, 80, 70]);
    const p = fake("serpapi", live(72));
    const r = await verifyTopDeals(db, rows, [W], [p], ctx, { ...DEFAULT_SETTINGS, verifyTopK: 1 });
    expect(p.verify).toHaveBeenCalledTimes(1);
    expect(r).toMatchObject({ verified: 1, stale: 0, statuses: { serpapi: "ok" } });
    const verified = await db.select().from(deals).where(eq(deals.status, "verified"));
    expect(verified.map((d) => [d.amount, d.source])).toEqual([[72, "serpapi"]]);
    const live_ = await db.select().from(observations).where(eq(observations.source, "serpapi"));
    expect(live_.map((o) => o.isCached)).toEqual([false]);
  });

  it("falls back to the next provider when one is exhausted", async () => {
    const { db, ctx, rows } = await setup([70]);
    const a = fake("serpapi", {
      ok: false,
      kind: "quota_exhausted",
      reason: "serpapi quota exhausted",
    });
    const b = fake("travelpayouts", live(71));
    const r = await verifyTopDeals(db, rows, [W], [a, b], ctx, DEFAULT_SETTINGS);
    expect(r.verified).toBe(1);
    expect(r.statuses).toMatchObject({ serpapi: "quota_exhausted", travelpayouts: "ok" });
  });

  it("stays a candidate with a note when every provider fails", async () => {
    const { db, ctx, rows } = await setup([70]);
    const a = fake("serpapi", {
      ok: false,
      kind: "quota_exhausted",
      reason: "serpapi quota exhausted",
    });
    await verifyTopDeals(db, rows, [W], [a], ctx, DEFAULT_SETTINGS);
    const [d] = await db.select().from(deals);
    expect(d).toMatchObject({
      status: "candidate",
      verifiedAt: null,
      verifyNote: "serpapi quota exhausted",
    });
  });

  it("marks the deal stale when the live price is gone or too high", async () => {
    const gone = await setup([70]);
    await verifyTopDeals(
      gone.db,
      gone.rows,
      [W],
      [fake("serpapi", { ok: true, observations: [], dropped: 0 })],
      gone.ctx,
      DEFAULT_SETTINGS,
    );
    const [g] = await gone.db.select().from(deals);
    expect(g).toMatchObject({ status: "stale", amount: 70 });
    expect(g?.verifiedAt).not.toBeNull();

    const high = await setup([70]);
    const r = await verifyTopDeals(
      high.db,
      high.rows,
      [W],
      [fake("serpapi", live(90))],
      high.ctx,
      DEFAULT_SETTINGS,
    );
    expect(r.stale).toBe(1);
  });

  it("skips deals attempted within verifyCacheHours", async () => {
    const { db, ctx, rows } = await setup([70]);
    const p = fake("serpapi", live(70));
    await verifyTopDeals(db, rows, [W], [p], ctx, DEFAULT_SETTINGS);
    const again = await db.select().from(deals);
    await verifyTopDeals(db, again, [W], [p], ctx, DEFAULT_SETTINGS);
    expect(p.verify).toHaveBeenCalledTimes(1);
  });
});
