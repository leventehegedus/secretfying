import type { Prices } from "./schemas";

export type Point = { x: number; amount: number };
export type Line = { x: number; median: number | null; p10: number | null };

const DAY_MS = 86_400_000;
const dayX = (day: string): number => Date.parse(`${day}T12:00:00Z`);

/** Reshape only; null stats stay null so the chart shows a gap, not 0. */
export function chartData(p: Prices): {
  points: Point[];
  lines: Line[];
  domain: [number, number];
} {
  // Points share the stats' midday x, one day of padding keeps a single day from collapsing.
  const points = p.series.map((o) => ({ x: dayX(o.observedAt.slice(0, 10)), amount: o.amount }));
  const lines = p.stats.map((s) => ({ x: dayX(s.day), median: s.median, p10: s.p10 }));
  const xs = [...points, ...lines].map((d) => d.x);
  return { points, lines, domain: [Math.min(...xs) - DAY_MS, Math.max(...xs) + DAY_MS] };
}
