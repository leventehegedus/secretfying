import type { PriceInsights } from "../schemas/observation.js";
import type { ReasonCode } from "../schemas/deal.js";
import type { Settings } from "../schemas/settings.js";
import type { HistoryStats } from "./stats.js";

export type FareEvaluation = {
  reasons: ReasonCode[];
  discountPct: number | null;
  belowMaxPct: number | null;
};

const round1 = (n: number): number => Math.round(n * 10) / 10;

export function evaluateFare(input: {
  amount: number;
  maxPrice: number | null;
  stats: HistoryStats;
  insights?: PriceInsights | null;
  settings: Settings;
}): FareEvaluation {
  const { amount, maxPrice, stats, insights, settings } = input;
  const reasons: ReasonCode[] = [];
  const belowMaxPct = maxPrice === null ? null : round1(((maxPrice - amount) / maxPrice) * 100);
  if (maxPrice !== null && amount <= maxPrice) reasons.push("BELOW_MAX_PRICE");

  let discountPct: number | null = null;
  const { median, p10, min } = stats;
  if (stats.sufficiency === "ok" && median !== null && p10 !== null && min !== null) {
    discountPct = round1(((median - amount) / median) * 100);
    // Multiply out the percentage to avoid float noise at the boundary.
    if (amount * 100 <= median * (100 - settings.belowMedianPct)) reasons.push("BELOW_MEDIAN_PCT");
    if (amount < p10) reasons.push("BELOW_P10");
    if (amount < min) reasons.push("NEW_ROUTE_LOW");
    if (insights?.level === "low") reasons.push("PROVIDER_PRICE_LEVEL_LOW");
  }
  return { reasons, discountPct, belowMaxPct };
}
