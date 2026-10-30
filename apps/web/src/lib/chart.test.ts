import { describe, expect, it } from "vitest";
import { chartData } from "./chart";
import type { Prices } from "./schemas";

const prices: Prices = {
  series: [
    {
      observedAt: "2026-10-02T06:00:00.000Z",
      amount: 80,
      departDate: "2026-12-01",
      returnDate: null,
      source: "travelpayouts",
      isCached: true,
    },
  ],
  stats: [
    { day: "2026-10-01", median: null, p10: null, sufficiency: "insufficient_history" },
    { day: "2026-10-02", median: 90, p10: 70, sufficiency: "ok" },
  ],
};

describe("chartData", () => {
  it("keeps null stats as gaps, never 0", () => {
    const { lines } = chartData(prices);
    expect(lines[0]).toMatchObject({ median: null, p10: null });
    expect(lines[1]).toMatchObject({ median: 90, p10: 70 });
  });

  it("puts observations at their day's midday and pads the domain by a day", () => {
    const { points, domain } = chartData(prices);
    expect(points).toEqual([{ x: Date.parse("2026-10-02T12:00:00.000Z"), amount: 80 }]);
    expect(domain).toEqual([
      Date.parse("2026-09-30T12:00:00.000Z"),
      Date.parse("2026-10-03T12:00:00.000Z"),
    ]);
  });
});
