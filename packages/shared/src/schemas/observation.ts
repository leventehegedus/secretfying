import { z } from "zod";
import { Currency, Iata, IsoDate, IsoDateTime, ProviderId } from "./common.js";

export const PriceObservation = z
  .object({
    source: ProviderId,
    isCached: z.boolean(),
    observedAt: IsoDateTime,
    expiresAt: IsoDateTime.optional(),
    currency: Currency,
    amount: z.number().finite().positive(),
    origin: Iata,
    destination: Iata,
    departDate: IsoDate,
    returnDate: IsoDate.nullable(),
    stops: z.number().int().min(0).max(4),
    deepLink: z.url({ protocol: /^https$/ }).optional(),
    market: z.string().optional(),
  })
  .refine((o) => o.origin !== o.destination, { message: "origin equals destination" })
  .refine((o) => o.returnDate === null || o.returnDate >= o.departDate, {
    message: "returnDate before departDate",
  })
  .refine((o) => o.departDate >= o.observedAt.slice(0, 10), {
    message: "departDate before observation date",
  });
export type PriceObservation = z.infer<typeof PriceObservation>;

export const PriceInsights = z.object({
  level: z.enum(["low", "typical", "high"]).nullable(),
  typicalLow: z.number().nullable(),
  typicalHigh: z.number().nullable(),
});
export type PriceInsights = z.infer<typeof PriceInsights>;
