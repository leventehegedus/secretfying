import { z } from "zod";

const pct = (d: number) => z.number().min(0).max(100).default(d);
const posInt = (d: number) => z.number().int().positive().default(d);

export const Settings = z.object({
  minObservations: posInt(14),
  minSpanDays: posInt(7),
  medianWindowDays: posInt(90),
  belowMedianPct: pct(30),
  lowPercentile: pct(10),
  verifyTolerancePct: pct(10),
  verifyTopK: posInt(5),
  verifyCacheHours: posInt(24),
  realertDropPct: pct(5),
  alertCandidates: z.boolean().default(false),
  language: z.enum(["hu", "en"]).default("hu"),
});
export type Settings = z.infer<typeof Settings>;

export const DEFAULT_SETTINGS: Settings = Settings.parse({});
