import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, PriceObservation, Settings, WatchInput } from "../index.js";

const base = {
  source: "travelpayouts",
  isCached: true,
  observedAt: "2026-10-30T06:00:00Z",
  currency: "EUR",
  amount: 50,
  origin: "BUD",
  destination: "LIS",
  departDate: "2026-12-01",
  returnDate: null,
  stops: 0,
};
const bad = (patch: object) => PriceObservation.safeParse({ ...base, ...patch }).success;

describe("PriceObservation", () => {
  it("accepts one-way and return rows", () => {
    expect(bad({})).toBe(true);
    expect(bad({ returnDate: "2026-12-08" })).toBe(true);
  });
  it.each([
    ["amount 0", { amount: 0 }],
    ["amount -1", { amount: -1 }],
    ["amount NaN", { amount: NaN }],
    ["same origin/destination", { destination: "BUD" }],
    ["return before depart", { returnDate: "2026-11-30" }],
    ["depart before observed", { departDate: "2026-10-29" }],
    ["http deepLink", { deepLink: "http://x.com/a" }],
    ["lowercase iata", { origin: "bud" }],
    ["2026-02-30", { departDate: "2026-02-30" }],
    ["non-EUR currency", { currency: "HUF" }],
  ])("rejects %s", (_n, patch) => {
    expect(bad(patch)).toBe(false);
  });
});

describe("Settings", () => {
  it("parses {} to the 11 defaults", () => {
    expect(Settings.parse({})).toEqual(DEFAULT_SETTINGS);
    expect(Object.keys(DEFAULT_SETTINGS)).toHaveLength(11);
    expect(DEFAULT_SETTINGS.minObservations).toBe(14);
  });
  it("rejects belowMedianPct 120", () => {
    expect(Settings.safeParse({ belowMedianPct: 120 }).success).toBe(false);
  });
});

describe("WatchInput", () => {
  it("defaults origin to BUD and accepts ANYWHERE", () => {
    const w = WatchInput.parse({ destination: "ANYWHERE" });
    expect(w.origin).toBe("BUD");
    expect(w.destination).toBe("ANYWHERE");
  });
  it("rejects minStay > maxStay", () => {
    expect(WatchInput.safeParse({ destination: "LIS", minStay: 5, maxStay: 3 }).success).toBe(
      false,
    );
  });
  it("rejects maxStay on oneway", () => {
    const r = WatchInput.safeParse({ destination: "LIS", tripType: "oneway", maxStay: 3 });
    expect(r.success).toBe(false);
  });
});
