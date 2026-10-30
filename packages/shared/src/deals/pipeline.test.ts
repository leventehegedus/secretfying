import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../schemas/settings.js";
import { applyVerification, isAlertable, pickForVerification, rankScore, routeKey, shouldAlert } from "./pipeline.js";
import type { HistoryStats } from "./stats.js";

const d = (id: string, discountPct: number | null, belowMaxPct: number | null, amount: number) => ({
  id, discountPct, belowMaxPct, amount,
});
const stats: HistoryStats = {
  sufficiency: "ok", count: 20, spanDays: 20, basis: "route", median: 200, p10: 100, min: 90,
};
const verify = (live: number | null, maxPrice: number | null = 120, s: HistoryStats = stats) =>
  applyVerification({
    candidateAmount: 100,
    live: live === null ? null : { amount: live },
    maxPrice, stats: s, settings: DEFAULT_SETTINGS,
  });

describe("ranking", () => {
  it("orders by best score, nulls last, ties by lower amount", () => {
    const a = d("a", null, null, 10);
    const b = d("b", null, 25, 50);
    const c = d("c", 40, null, 70);
    const e = d("e", 40, null, 60);
    expect(pickForVerification([a, b, c, e], 10, () => false).map((x) => x.id)).toEqual(["e", "c", "b", "a"]);
    expect(rankScore(a)).toBe(-Infinity);
  });
  it("skips recently verified and respects k", () => {
    const deals = [d("a", 50, null, 1), d("b", 40, null, 1), d("c", 30, null, 1)];
    expect(pickForVerification(deals, 1, (x) => x.id === "a").map((x) => x.id)).toEqual(["b"]);
  });
});

describe("applyVerification", () => {
  it("live null is stale", () => {
    expect(verify(null)).toMatchObject({ status: "stale", amount: null, reasons: [] });
  });
  it("tolerance boundary", () => {
    expect(verify(110, 120)).toMatchObject({ status: "verified", amount: 110 });
    expect(verify(110.01, 120).status).toBe("stale");
  });
  it("cheaper live is verified at live amount", () => {
    expect(verify(80)).toMatchObject({ status: "verified", amount: 80 });
  });
  it("within tolerance but no rule fires is stale", () => {
    expect(verify(105, 50, { ...stats, median: 110, p10: 90, min: 80 }).status).toBe("stale");
  });
});

describe("alerts", () => {
  it("isAlertable", () => {
    expect(isAlertable("candidate", DEFAULT_SETTINGS)).toBe(false);
    expect(isAlertable("candidate", { ...DEFAULT_SETTINGS, alertCandidates: true })).toBe(true);
    expect(isAlertable("verified", DEFAULT_SETTINGS)).toBe(true);
    expect(isAlertable("stale", { ...DEFAULT_SETTINGS, alertCandidates: true })).toBe(false);
  });
  it("shouldAlert", () => {
    expect(shouldAlert(95, 100, DEFAULT_SETTINGS)).toBe(true);
    expect(shouldAlert(95.01, 100, DEFAULT_SETTINGS)).toBe(false);
    expect(shouldAlert(500, null, DEFAULT_SETTINGS)).toBe(true);
  });
  it("routeKey", () => {
    expect(routeKey("BUD", "LIS", "return")).toBe("BUD-LIS-return");
  });
});
