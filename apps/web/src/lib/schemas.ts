import { ProviderId, ProviderStatus } from "@fdw/shared";
import { z } from "zod";

// Response shapes that the API builds itself and that @fdw/shared does not export.
// Run summaries are stored JSON, so every field is optional (old rows may be partial).
export const RunSummary = z.object({
  stored: z.number().optional(),
  deals: z.number().optional(),
  verified: z.number().optional(),
  stale: z.number().optional(),
  error: z.string().optional(),
  providers: z.partialRecord(ProviderId, ProviderStatus).optional(),
});

export const Run = z.object({
  id: z.number(),
  status: z.enum(["running", "done", "failed"]),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  summary: RunSummary.nullable().catch(null),
});
export type Run = z.infer<typeof Run>;

export const QuotaUsage = z.object({
  dayUsed: z.number(),
  dayCap: z.number(),
  monthUsed: z.number(),
  monthCap: z.number(),
});
export const Quota = z.object({ travelpayouts: QuotaUsage, serpapi: QuotaUsage });
export type Quota = z.infer<typeof Quota>;

export const Providers = z.partialRecord(ProviderId, ProviderStatus);

export const Place = z.object({
  code: z.string(),
  name: z.string(),
  kind: z.enum(["city", "airport"]),
});
export type Place = z.infer<typeof Place>;

export const Prices = z.object({
  series: z.array(
    z.object({
      observedAt: z.string(),
      amount: z.number(),
      departDate: z.string(),
      returnDate: z.string().nullable(),
      source: ProviderId,
      isCached: z.boolean(),
    }),
  ),
  stats: z.array(
    z.object({
      day: z.string(),
      median: z.number().nullable(),
      p10: z.number().nullable(),
      sufficiency: z.enum(["ok", "insufficient_history"]),
    }),
  ),
});
export type Prices = z.infer<typeof Prices>;
export type Observation = Prices["series"][number];

export const RANGES = ["30d", "90d", "365d"] as const;
export type Range = (typeof RANGES)[number];
