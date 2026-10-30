import type { Prices } from "./schemas";

export type Point = { x: number; amount: number };
export type Line = { x: number; median: number | null; p10: number | null };

/** Reshape only; null stats stay null so the chart shows a gap, not 0. */
export function chartData(p: Prices): { points: Point[]; lines: Line[] } {
  return {
    points: p.series.map((o) => ({ x: Date.parse(o.observedAt), amount: o.amount })),
    lines: p.stats.map((s) => ({
      x: Date.parse(`${s.day}T12:00:00Z`),
      median: s.median,
      p10: s.p10,
    })),
  };
}
