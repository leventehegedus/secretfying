import { describe, expect, it, vi } from "vitest";
import cities from "./fixtures/travelpayouts-cities.json" with { type: "json" };
import airports from "./fixtures/travelpayouts-airports.json" with { type: "json" };
import fixture from "./fixtures/travelpayouts-prices-for-dates.json" with { type: "json" };
import { loadIataCodes } from "./iata.js";
import { jsonRes, NOW, testCtx } from "./testkit.js";
import { createTravelpayouts, parsePricesForDates } from "./travelpayouts.js";
import type { DiscoverQuery } from "./types.js";

const observedAt = NOW.toISOString();
const q: DiscoverQuery = {
  origin: "BUD",
  destination: "ANYWHERE",
  month: "2026-12",
  tripType: "return",
  currency: "EUR",
  market: "hu",
};
const cfg = { TRAVELPAYOUTS_TOKEN: "SECRET-TOKEN", TRAVELPAYOUTS_MIN_INTERVAL_MS: 1000 };
const parse = (json: unknown, log = vi.fn()) =>
  parsePricesForDates(json, { observedAt, market: "hu", log });

describe("parsePricesForDates", () => {
  it("maps fixture rows", () => {
    const { observations, dropped } = parse(fixture);
    expect(dropped).toBe(0);
    expect(observations).toHaveLength(4);
    expect(observations[0]).toMatchObject({
      source: "travelpayouts",
      isCached: true,
      currency: "EUR",
      amount: 89,
      departDate: "2026-12-05",
      returnDate: "2026-12-10",
      stops: 1,
      market: "hu",
      deepLink: "https://www.aviasales.com/search/BUD0512LIS10121?t=TP1",
    });
    expect(observations[2]).toMatchObject({ returnDate: null, stops: 0 });
  });

  it("drops and counts price 0, bad IATA and malformed rows", () => {
    const [a, b] = fixture.data;
    const log = vi.fn();
    const bad = { ...fixture, data: [a, { ...b, price: 0 }, { ...b, origin: "bud" }, { nope: 1 }] };
    const r = parse(bad, log);
    expect(r.observations).toHaveLength(1);
    expect(r.dropped).toBe(3);
    expect(log).toHaveBeenCalledOnce();
  });

  it("drops every row when the currency is not EUR", () => {
    const r = parse({ ...fixture, currency: "usd" });
    expect(r).toMatchObject({ observations: [], dropped: 4 });
  });
});

describe("travelpayouts discover", () => {
  it("sends the token as header only and serves the second call from cache", async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => jsonRes(fixture));
    const { ctx, guard } = await testCtx(fetchFn);
    const p = createTravelpayouts(cfg);
    const r1 = await p.discover?.(q, ctx);
    const r2 = await p.discover?.(q, ctx);
    expect(r1).toMatchObject({ ok: true, dropped: 0 });
    expect(r2).toMatchObject({ ok: true });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0] ?? [];
    expect(String(url)).not.toContain("SECRET-TOKEN");
    expect(String(url)).toContain("/aviasales/v3/prices_for_dates?origin=BUD&departure_at=2026-12");
    expect(String(url)).not.toContain("destination=");
    expect(String(url)).toContain("one_way=false");
    expect(init?.headers).toEqual({ "X-Access-Token": "SECRET-TOKEN" });
    expect((await guard.remaining("travelpayouts")).dayUsed).toBe(1);
  });

  it("builds a oneway route query", async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => jsonRes(fixture));
    const { ctx } = await testCtx(fetchFn);
    await createTravelpayouts(cfg).discover?.(
      { ...q, destination: "LIS", tripType: "oneway" },
      ctx,
    );
    const url = String(fetchFn.mock.calls[0]?.[0]);
    expect(String(url)).toContain("destination=LIS");
    expect(String(url)).toContain("one_way=true");
    expect(String(url)).not.toContain("return_at");
  });

  it("waits the min interval between live calls", async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => jsonRes(fixture));
    const { ctx } = await testCtx(fetchFn);
    const sleep = vi.fn(async () => {});
    const p = createTravelpayouts(cfg);
    await p.discover?.(q, { ...ctx, sleep });
    await p.discover?.({ ...q, month: "2027-01" }, { ...ctx, sleep });
    expect(sleep).toHaveBeenCalledWith(1000);
  });

  it("reports quota exhaustion without fetching", async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => jsonRes(fixture));
    const { ctx } = await testCtx(fetchFn, { cap: 0 });
    const r = await createTravelpayouts(cfg).discover?.(q, ctx);
    expect(r).toMatchObject({ ok: false, kind: "quota_exhausted" });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("does not cache an unexpected response shape", async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => jsonRes({ error: "boom" }));
    const { ctx } = await testCtx(fetchFn);
    const p = createTravelpayouts(cfg);
    expect(await p.discover?.(q, ctx)).toMatchObject({ ok: false, kind: "unavailable" });
    await p.discover?.(q, ctx);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});

describe("loadIataCodes", () => {
  it("keeps flightable codes, caches the list, and does not touch quota", async () => {
    const fetchFn = vi.fn<typeof fetch>(async (u) =>
      jsonRes(String(u).endsWith("cities.json") ? cities : airports),
    );
    const { ctx, guard } = await testCtx(fetchFn);
    const codes = await loadIataCodes(ctx);
    expect([...codes].sort()).toEqual(["BCN", "BUD", "FCO", "LHR", "LIS", "LON", "STN"]);
    await loadIataCodes(ctx);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect((await guard.remaining("travelpayouts")).dayUsed).toBe(0);
  });
});
