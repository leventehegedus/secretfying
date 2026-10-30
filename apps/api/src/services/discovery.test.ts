import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { observations } from "../db/schema.js";
import type { FlightPriceProvider, ProviderResult } from "../providers/types.js";
import { NOW, testCtx } from "../providers/testkit.js";
import { insertWatch, obs, watch } from "../test/builders.js";
import { discoverForWatch } from "./discovery.js";
import { matchesWatch, watchMonths } from "./watches.js";

const TZ = "Europe/Budapest";
const fake = (id: "travelpayouts" | "serpapi", r: ProviderResult): FlightPriceProvider => ({
  id,
  discover: vi.fn(async () => r),
});
const ok = (...o: ReturnType<typeof obs>[]): ProviderResult => ({
  ok: true,
  observations: o,
  dropped: 0,
});
const noFetch = (async () => new Response("{}")) as typeof fetch;

describe("watchMonths", () => {
  it("crosses the year boundary from November", () => {
    const now = new Date("2026-11-15T10:00:00Z");
    expect(watchMonths(watch(), now, TZ)).toEqual(["2026-11", "2026-12", "2027-01"]);
  });
  it("uses the departFrom/departTo window", () => {
    const w = watch({ departFrom: "2026-12-20", departTo: "2027-02-03" });
    expect(watchMonths(w, NOW, TZ)).toEqual(["2026-12", "2027-01", "2027-02"]);
  });
});

describe("matchesWatch", () => {
  const w = watch({ minStay: 3, maxStay: 7, maxStops: 1, departFrom: "2026-12-01" });
  it("filters stay length, stops, window and trip type", () => {
    expect(matchesWatch(obs(), w)).toBe(true); // 5 nights
    expect(matchesWatch(obs({ returnDate: "2026-12-06" }), w)).toBe(false); // 1 night
    expect(matchesWatch(obs({ returnDate: "2026-12-20" }), w)).toBe(false); // 15 nights
    expect(matchesWatch(obs({ stops: 2 }), w)).toBe(false);
    expect(matchesWatch(obs({ departDate: "2026-11-30", returnDate: "2026-12-05" }), w)).toBe(
      false,
    );
    expect(matchesWatch(obs({ returnDate: null }), w)).toBe(false);
  });
});

describe("discoverForWatch", () => {
  it("re-storing the same day keeps one row with the newest price", async () => {
    const { ctx, db } = await testCtx(noFetch);
    await insertWatch(db);
    const w = watch({ monthsAhead: 1 });
    const run = (amount: number) =>
      discoverForWatch(db, w, [fake("travelpayouts", ok(obs({ amount })))], ctx, {
        market: "hu",
        budget: { left: 10 },
        tz: TZ,
      });
    await run(120);
    await run(99);
    const rows = await db.select().from(observations).where(eq(observations.origin, "BUD"));
    expect(rows.map((r) => r.amount)).toEqual([99]);
  });

  it("falls through to the next provider and records each status", async () => {
    const { ctx, db } = await testCtx(noFetch);
    const down = fake("travelpayouts", { ok: false, kind: "unavailable", reason: "x" });
    const good = fake("serpapi", ok(obs({ source: "serpapi" })));
    const r = await discoverForWatch(db, watch({ monthsAhead: 1 }), [down, good], ctx, {
      market: "hu",
      budget: { left: 10 },
      tz: TZ,
    });
    expect(r.statuses).toEqual({ travelpayouts: "unavailable", serpapi: "ok" });
    expect(r.stored).toHaveLength(1);
  });

  it("stops at the per-run query budget", async () => {
    const { ctx, db } = await testCtx(noFetch);
    const p = fake("travelpayouts", ok());
    const budget = { left: 2 };
    const r = await discoverForWatch(db, watch({ monthsAhead: 3 }), [p], ctx, {
      market: "hu",
      budget,
      tz: TZ,
    });
    expect(r.queries).toBe(2);
    expect(p.discover).toHaveBeenCalledTimes(2);
    expect(budget.left).toBe(0);
  });
});
