import { DEFAULT_SETTINGS, Watch } from "@fdw/shared";
import type { PriceObservation } from "@fdw/shared";
import { observationKey } from "../db/keys.js";
import type { Db } from "../db/client.js";
import { observations, watches } from "../db/schema.js";

export const watch = (o: Partial<Watch> = {}): Watch =>
  Watch.parse({
    id: 1,
    origin: "BUD",
    destination: "LIS",
    tripType: "return",
    monthsAhead: 3,
    maxStops: 1,
    createdAt: "2026-10-01T00:00:00Z",
    ...o,
  });

export const obs = (o: Partial<PriceObservation> = {}): PriceObservation => ({
  source: "travelpayouts",
  isCached: true,
  observedAt: "2026-10-30T10:00:00.000Z",
  currency: "EUR",
  amount: 100,
  origin: "BUD",
  destination: "LIS",
  departDate: "2026-12-05",
  returnDate: "2026-12-10",
  stops: 0,
  ...o,
});

export const insertWatch = async (db: Db, w: Watch = watch()) => {
  await db.insert(watches).values({
    id: w.id,
    origin: w.origin,
    destination: w.destination,
    monthsAhead: w.monthsAhead,
    departFrom: w.departFrom ?? null,
    departTo: w.departTo ?? null,
    minStay: w.minStay ?? null,
    maxStay: w.maxStay ?? null,
    tripType: w.tripType,
    maxStops: w.maxStops,
    maxPrice: w.maxPrice,
    active: w.active,
    createdAt: w.createdAt,
  });
};

// Direct insert: bypasses the "departDate after observedAt" rule so history can be backdated.
export const insertHistory = async (db: Db, n: number, amount: (i: number) => number) => {
  await db.insert(observations).values(
    Array.from({ length: n }, (_, i) => {
      const o = obs({
        amount: amount(i),
        observedAt: new Date(Date.UTC(2026, 9, 1 + i, 8)).toISOString(),
      });
      const observedDay = o.observedAt.slice(0, 10);
      return {
        ...o,
        observedDay,
        key: observationKey({ ...o, observedDay }),
        expiresAt: null,
        deepLink: null,
        market: null,
      };
    }),
  );
};

export { DEFAULT_SETTINGS };
