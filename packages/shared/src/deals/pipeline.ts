import type { DealStatus, ReasonCode } from "../schemas/deal.js";
import type { PriceInsights } from "../schemas/observation.js";
import type { Settings } from "../schemas/settings.js";
import type { TripType } from "../schemas/common.js";
import { evaluateFare } from "./evaluate.js";
import type { HistoryStats } from "./stats.js";

export type RankableDeal = {
  discountPct: number | null;
  belowMaxPct: number | null;
  amount: number;
};

export const rankScore = (d: Pick<RankableDeal, "discountPct" | "belowMaxPct">): number =>
  Math.max(d.discountPct ?? -Infinity, d.belowMaxPct ?? -Infinity);

export function pickForVerification<T extends RankableDeal>(
  deals: readonly T[],
  k: number,
  isRecentlyVerified: (d: T) => boolean,
): T[] {
  return deals
    .filter((d) => !isRecentlyVerified(d))
    .sort((a, b) => rankScore(b) - rankScore(a) || a.amount - b.amount)
    .slice(0, k);
}

export type VerificationOutcome = {
  status: "verified" | "stale";
  amount: number | null;
  reasons: ReasonCode[];
  discountPct: number | null;
  belowMaxPct: number | null;
};

export function applyVerification(input: {
  candidateAmount: number;
  live: { amount: number; insights?: PriceInsights | null } | null;
  maxPrice: number | null;
  stats: HistoryStats;
  settings: Settings;
}): VerificationOutcome {
  const { candidateAmount, live, maxPrice, stats, settings } = input;
  const stale: VerificationOutcome = {
    status: "stale", amount: live?.amount ?? null, reasons: [], discountPct: null, belowMaxPct: null,
  };
  if (live === null) return stale;
  // Multiplied out to avoid float noise at the tolerance boundary.
  if (live.amount * 100 > candidateAmount * (100 + settings.verifyTolerancePct)) return stale;
  const ev = evaluateFare({ amount: live.amount, maxPrice, stats, insights: live.insights, settings });
  return ev.reasons.length === 0 ? stale : { status: "verified", amount: live.amount, ...ev };
}

export const isAlertable = (status: DealStatus, settings: Settings): boolean =>
  status === "verified" || (status === "candidate" && settings.alertCandidates);

export const shouldAlert = (amount: number, lastAlertAmount: number | null, settings: Settings): boolean =>
  lastAlertAmount === null || amount * 100 <= lastAlertAmount * (100 - settings.realertDropPct);

export const routeKey = (origin: string, destination: string, tripType: TripType): string =>
  `${origin}-${destination}-${tripType}`;
