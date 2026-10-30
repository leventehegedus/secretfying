import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../schemas/settings.js";
import { historyStats, median, percentile, type HistoryPoint } from "./stats.js";

const now = new Date("2026-10-30T12:00:00Z");
const day = 86_400_000;
// n points evenly spread over spanDays, ending daysAgo before now.
const pts = (n: number, spanDays: number, depart: string, daysAgo = 0): HistoryPoint[] =>
  Array.from({ length: n }, (_, i) => ({
    amount: 100 + i,
    observedAt: new Date(
      now.getTime() - (daysAgo + spanDays - (n > 1 ? (i * spanDays) / (n - 1) : 0)) * day,
    ).toISOString(),
    departDate: depart,
  }));
const run = (h: HistoryPoint[]) =>
  historyStats(h, { now, departMonth: "2026-12", settings: DEFAULT_SETTINGS });

describe("median", () => {
  it("handles empty, odd and even", () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
});

describe("percentile", () => {
  it("is nearest rank", () => {
    const v = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    expect(percentile(v, 10)).toBe(10);
    expect(percentile([5], 10)).toBe(5);
    expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3);
    expect(v).toContain(percentile(v, 33));
    expect(percentile([], 10)).toBeNull();
  });
});

describe("historyStats", () => {
  it("13 points is insufficient with null stats", () => {
    const s = run(pts(13, 10, "2026-12-05"));
    expect(s).toMatchObject({
      sufficiency: "insufficient_history",
      median: null,
      p10: null,
      min: null,
    });
  });
  it("14 points over 6.9 days is insufficient", () => {
    expect(run(pts(14, 6.9, "2026-12-05")).sufficiency).toBe("insufficient_history");
  });
  it("14 points over exactly 7 days is ok", () => {
    const s = run(pts(14, 7, "2026-12-05"));
    expect(s.sufficiency).toBe("ok");
    expect(s.spanDays).toBe(7);
    expect(s.median).not.toBeNull();
  });
  it("excludes points older than 90 days", () => {
    const s = run([...pts(14, 7, "2026-12-05"), ...pts(5, 3, "2026-12-05", 100)]);
    expect(s.count).toBe(14);
  });
  it("uses month basis when the month alone is sufficient", () => {
    expect(run(pts(14, 7, "2026-12-05")).basis).toBe("month");
  });
  it("falls back to route basis", () => {
    const h = [...pts(10, 7, "2026-12-05"), ...pts(10, 7, "2027-01-05")];
    const s = run(h);
    expect(s.basis).toBe("route");
    expect(s.count).toBe(20);
  });
  it("min is the lowest ever stored for the route, not only the window or month", () => {
    const old = {
      amount: 50,
      observedAt: new Date(now.getTime() - 200 * day).toISOString(),
      departDate: "2027-03-01",
    };
    expect(run([...pts(14, 7, "2026-12-05"), old]).min).toBe(50);
  });
  it("insufficient has null basis", () => {
    expect(run([]).basis).toBeNull();
  });
});
