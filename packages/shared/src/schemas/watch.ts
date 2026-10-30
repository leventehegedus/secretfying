import { z } from "zod";
import { Destination, Iata, IsoDate, IsoDateTime, TripType } from "./common.js";

const WatchFields = z.object({
  origin: Iata.default("BUD"),
  destination: Destination,
  monthsAhead: z.number().int().min(1).max(12).default(3),
  departFrom: IsoDate.optional(),
  departTo: IsoDate.optional(),
  minStay: z.number().int().positive().optional(),
  maxStay: z.number().int().positive().optional(),
  tripType: TripType.default("return"),
  maxStops: z.number().int().min(0).max(4).default(1),
  maxPrice: z.number().positive().nullable().default(null),
  active: z.boolean().default(true),
});

type StayRules = {
  tripType: z.infer<typeof TripType>;
  minStay?: number | undefined;
  maxStay?: number | undefined;
  departFrom?: string | undefined;
  departTo?: string | undefined;
};
const stayOk = (w: StayRules) =>
  (w.minStay === undefined || w.maxStay === undefined || w.minStay <= w.maxStay) &&
  (w.tripType === "return" || w.maxStay === undefined) &&
  (w.departFrom === undefined || w.departTo === undefined || w.departFrom <= w.departTo);

export const WatchInput = WatchFields.refine(stayOk, { message: "invalid stay length" });
export type WatchInput = z.infer<typeof WatchInput>;

export const Watch = WatchFields.extend({
  id: z.number().int().positive(),
  createdAt: IsoDateTime,
}).refine(stayOk, { message: "invalid stay length" });
export type Watch = z.infer<typeof Watch>;
