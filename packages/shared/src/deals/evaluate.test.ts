import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../schemas/settings.js";
import { evaluateFare } from "./evaluate.js";
import type { HistoryStats } from "./stats.js";

const ok = (o: Partial<HistoryStats> = {}): HistoryStats => ({
  sufficiency: "ok",
  count: 20,
  spanDays: 20,
  basis: "route",
  median: 100,
  p10: 60,
  min: 50,
  ...o,
});
const insufficient: HistoryStats = {
  sufficiency: "insufficient_history",
  count: 3,
  spanDays: 2,
  basis: null,
  median: null,
  p10: null,
  min: null,
};
const run = (
  amount: number,
  stats: HistoryStats,
  extra: { maxPrice?: number | null; level?: "low" } = {},
) =>
  evaluateFare({
    amount,
    maxPrice: extra.maxPrice ?? null,
    stats,
    insights: extra.level ? { level: extra.level, typicalLow: null, typicalHigh: null } : null,
    settings: DEFAULT_SETTINGS,
  });

describe("evaluateFare", () => {
  it("BELOW_MAX_PRICE at the boundary", () => {
    expect(run(150, ok(), { maxPrice: 150 }).reasons).toContain("BELOW_MAX_PRICE");
    expect(run(150.01, ok(), { maxPrice: 150 }).reasons).not.toContain("BELOW_MAX_PRICE");
  });
  it("BELOW_MEDIAN_PCT at the boundary", () => {
    expect(run(70, ok()).reasons).toContain("BELOW_MEDIAN_PCT");
    expect(run(70.01, ok()).reasons).not.toContain("BELOW_MEDIAN_PCT");
  });
  it("BELOW_P10 is strict", () => {
    expect(run(60, ok()).reasons).not.toContain("BELOW_P10");
    expect(run(59.99, ok()).reasons).toContain("BELOW_P10");
  });
  it("NEW_ROUTE_LOW is strict", () => {
    expect(run(50, ok()).reasons).not.toContain("NEW_ROUTE_LOW");
    expect(run(49.99, ok()).reasons).toContain("NEW_ROUTE_LOW");
  });
  it("provider level low fires", () => {
    expect(run(90, ok(), { level: "low" }).reasons).toEqual(["PROVIDER_PRICE_LEVEL_LOW"]);
  });
  it("insufficient history only allows BELOW_MAX_PRICE", () => {
    const r = run(40, insufficient, { maxPrice: 100, level: "low" });
    expect(r).toEqual({ reasons: ["BELOW_MAX_PRICE"], discountPct: null, belowMaxPct: 60 });
  });
  it("computes percentages to one decimal", () => {
    expect(run(130, ok({ median: 200 })).discountPct).toBe(35);
    expect(run(120, ok(), { maxPrice: 150 }).belowMaxPct).toBe(20);
    expect(run(100, ok({ median: 300 })).discountPct).toBe(66.7);
  });
});
