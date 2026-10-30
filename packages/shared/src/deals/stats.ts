import type { Settings } from "../schemas/settings.js";

export type HistoryPoint = { amount: number; observedAt: string; departDate: string };

export type HistoryStats = {
  sufficiency: "ok" | "insufficient_history";
  count: number;
  spanDays: number;
  basis: "month" | "route" | null;
  median: number | null;
  p10: number | null;
  min: number | null;
};

const DAY_MS = 86_400_000;

const sortedAsc = (values: readonly number[]): number[] => [...values].sort((a, b) => a - b);

export function median(values: readonly number[]): number | null {
  const s = sortedAsc(values);
  const mid = s.length >> 1;
  const hi = s[mid];
  const lo = s[mid - 1];
  if (hi === undefined) return null;
  return s.length % 2 === 1 || lo === undefined ? hi : (lo + hi) / 2;
}

// Nearest rank: the result is always an observed price, never interpolated.
export function percentile(values: readonly number[], p: number): number | null {
  const s = sortedAsc(values);
  return s[Math.max(0, Math.ceil((p / 100) * s.length) - 1)] ?? null;
}

function measure(points: readonly HistoryPoint[]) {
  const times = points.map((h) => Date.parse(h.observedAt));
  const spanDays = times.length > 0 ? (Math.max(...times) - Math.min(...times)) / DAY_MS : 0;
  return { count: points.length, spanDays };
}

export function historyStats(
  history: readonly HistoryPoint[],
  opts: { now: Date; departMonth: string; settings: Settings },
): HistoryStats {
  const { now, departMonth, settings } = opts;
  const since = now.getTime() - settings.medianWindowDays * DAY_MS;
  const route = history.filter((h) => Date.parse(h.observedAt) >= since);
  const month = route.filter((h) => h.departDate.startsWith(departMonth));
  const enough = (pts: readonly HistoryPoint[]) => {
    const m = measure(pts);
    return m.count >= settings.minObservations && m.spanDays >= settings.minSpanDays;
  };

  const chosen = enough(month) ? month : route;
  const basis = chosen === month ? "month" : "route";
  if (!enough(chosen)) {
    return {
      sufficiency: "insufficient_history",
      ...measure(route),
      basis: null,
      median: null,
      p10: null,
      min: null,
    };
  }
  const amounts = chosen.map((h) => h.amount);
  return {
    sufficiency: "ok",
    ...measure(chosen),
    basis,
    median: median(amounts),
    p10: percentile(amounts, settings.lowPercentile),
    // NEW_ROUTE_LOW compares against the lowest price ever stored for the route.
    min: Math.min(...history.map((h) => h.amount)),
  };
}
