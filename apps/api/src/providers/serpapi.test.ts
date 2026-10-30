import { describe, expect, it, vi } from "vitest";
import fixture from "./fixtures/serpapi-google-flights.json" with { type: "json" };
import { createSerpApi, parseGoogleFlights } from "./serpapi.js";
import { jsonRes, NOW, testCtx } from "./testkit.js";
import type { VerifyQuery } from "./types.js";

const q: VerifyQuery = {
  origin: "BUD",
  destination: "LIS",
  departDate: "2026-12-05",
  returnDate: "2026-12-10",
  currency: "EUR",
  maxStops: 1,
};
const at = NOW.toISOString();

describe("parseGoogleFlights", () => {
  it("picks the cheapest across best+other within maxStops", () => {
    const r = (maxStops: number) => parseGoogleFlights(fixture, { ...q, maxStops }, at).observation;
    expect(r(1)).toMatchObject({ amount: 118, stops: 1, source: "serpapi", isCached: false });
    expect(r(0)?.amount).toBe(150);
    expect(r(2)?.amount).toBe(95);
  });

  it("maps price insights and the https deep link", () => {
    const r = parseGoogleFlights(fixture, q, at);
    expect(r.insights).toEqual({ level: "low", typicalLow: 140, typicalHigh: 210 });
    expect(r.observation?.deepLink).toBe("https://www.google.com/travel/flights?hl=en&curr=EUR");
  });

  it("omits a non-https link and nulls an unknown level", () => {
    const json = {
      ...fixture,
      search_metadata: { google_flights_url: "http://x.test" },
      price_insights: { price_level: "weird" },
    };
    const r = parseGoogleFlights(json, q, at);
    expect(r.observation?.deepLink).toBeUndefined();
    expect(r.insights).toEqual({ level: null, typicalLow: null, typicalHigh: null });
  });

  it("returns null when there are no flights", () => {
    expect(parseGoogleFlights({ error: "no results" }, q, at)).toEqual({
      observation: null,
      insights: null,
    });
  });
});

describe("serpapi verify", () => {
  it("builds the query, reserves quota and returns the observation", async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => jsonRes(fixture));
    const { ctx, guard } = await testCtx(fetchFn);
    const r = await createSerpApi({ SERPAPI_KEY: "KEY123" }).verify?.(q, ctx);
    expect(r).toMatchObject({ ok: true, dropped: 0, insights: { level: "low" } });
    const url = String(fetchFn.mock.calls[0]?.[0]);
    expect(url).toContain("engine=google_flights");
    expect(url).toContain("type=1");
    expect(url).toContain("stops=2");
    expect(url).toContain("return_date=2026-12-10");
    expect((await guard.remaining("serpapi")).dayUsed).toBe(1);
  });

  it("uses type 2 and no return_date for one-way", async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => jsonRes(fixture));
    const { ctx } = await testCtx(fetchFn);
    await createSerpApi({ SERPAPI_KEY: "K" }).verify?.(
      { ...q, returnDate: null, maxStops: 0 },
      ctx,
    );
    const url = String(fetchFn.mock.calls[0]?.[0]);
    expect(url).toContain("type=2");
    expect(url).toContain("stops=1");
    expect(url).not.toContain("return_date");
  });

  it("redacts the api_key in failures and reserves on every attempt", async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => jsonRes({}, 500));
    const { ctx, guard } = await testCtx(fetchFn);
    const r = await createSerpApi({ SERPAPI_KEY: "KEY123" }).verify?.(q, ctx);
    expect(r).toMatchObject({ ok: false, kind: "unavailable" });
    expect(JSON.stringify(r)).not.toContain("KEY123");
    expect(JSON.stringify(r)).toContain("api_key=***");
    expect((await guard.remaining("serpapi")).dayUsed).toBe(2);
  });

  it("reports dry_run without fetching", async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => jsonRes(fixture));
    const { ctx } = await testCtx(fetchFn, { dryRun: true });
    const r = await createSerpApi({ SERPAPI_KEY: "K" }).verify?.(q, ctx);
    expect(r).toMatchObject({ ok: false, kind: "dry_run" });
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
