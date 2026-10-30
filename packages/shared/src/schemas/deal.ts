import { z } from "zod";
import { Iata, IsoDate, IsoDateTime, ProviderId, TripType } from "./common.js";

export const ReasonCode = z.enum([
  "BELOW_MAX_PRICE",
  "BELOW_MEDIAN_PCT",
  "BELOW_P10",
  "NEW_ROUTE_LOW",
  "PROVIDER_PRICE_LEVEL_LOW",
]);
export type ReasonCode = z.infer<typeof ReasonCode>;

export const DealStatus = z.enum(["candidate", "verified", "stale"]);
export type DealStatus = z.infer<typeof DealStatus>;

export const ProviderStatus = z.enum([
  "ok",
  "disabled",
  "dry_run",
  "quota_exhausted",
  "unavailable",
]);
export type ProviderStatus = z.infer<typeof ProviderStatus>;

export const Deal = z.object({
  id: z.number().int().positive(),
  watchId: z.number().int().positive(),
  origin: Iata,
  destination: Iata,
  tripType: TripType,
  departDate: IsoDate,
  returnDate: IsoDate.nullable(),
  amount: z.number().positive(),
  source: ProviderId,
  status: DealStatus,
  reasons: z.array(ReasonCode),
  discountPct: z.number().nullable(),
  belowMaxPct: z.number().nullable(),
  detectedAt: IsoDateTime,
  verifiedAt: IsoDateTime.nullable(),
});
export type Deal = z.infer<typeof Deal>;
