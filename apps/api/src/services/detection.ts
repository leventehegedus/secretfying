import { evaluateFare, historyStats, routeKey } from "@fdw/shared";
import type { HistoryStats, PriceObservation, Settings, Watch } from "@fdw/shared";
import { and, eq, isNotNull, isNull, lt } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../db/client.js";
import { dealKey } from "../db/keys.js";
import { deals, observations } from "../db/schema.js";

export type DealRow = typeof deals.$inferSelect;

export const StatsSnapshot = z.object({
  sufficiency: z.enum(["ok", "insufficient_history"]),
  count: z.number(),
  spanDays: z.number(),
  basis: z.enum(["month", "route"]).nullable(),
  median: z.number().nullable(),
  p10: z.number().nullable(),
  min: z.number().nullable(),
});

const HOUR_MS = 3_600_000;
export const recentlyAttempted = (d: Pick<DealRow, "verifiedAt">, s: Settings, now: Date) =>
  d.verifiedAt !== null && now.getTime() - Date.parse(d.verifiedAt) < s.verifyCacheHours * HOUR_MS;

export async function detectDeals(
  db: Db,
  found: { watch: Watch; observations: PriceObservation[] }[],
  runStartedAt: Date,
  settings: Settings,
): Promise<DealRow[]> {
  const out: DealRow[] = [];
  const histories = new Map<
    string,
    Promise<{ amount: number; observedAt: string; departDate: string }[]>
  >();
  const history = (o: PriceObservation) => {
    const k = `${o.origin}|${o.destination}|${o.returnDate === null}|${o.currency}`;
    let h = histories.get(k);
    if (!h) {
      h = Promise.resolve(
        db
          .select({
            amount: observations.amount,
            observedAt: observations.observedAt,
            departDate: observations.departDate,
          })
          .from(observations)
          .where(
            and(
              eq(observations.origin, o.origin),
              eq(observations.destination, o.destination),
              eq(observations.currency, o.currency),
              o.returnDate === null
                ? isNull(observations.returnDate)
                : isNotNull(observations.returnDate),
              lt(observations.observedAt, runStartedAt.toISOString()),
            ),
          ),
      );
      histories.set(k, h);
    }
    return h;
  };

  for (const { watch, observations: obs } of found) {
    for (const o of obs) {
      const stats: HistoryStats = historyStats(await history(o), {
        now: runStartedAt,
        departMonth: o.departDate.slice(0, 7),
        settings,
      });
      const ev = evaluateFare({ amount: o.amount, maxPrice: watch.maxPrice, stats, settings });
      if (ev.reasons.length === 0) continue;
      const rk = routeKey(o.origin, o.destination, watch.tripType);
      const key = dealKey({
        watchId: watch.id,
        routeKey: rk,
        departDate: o.departDate,
        returnDate: o.returnDate,
      });
      const [existing] = await db.select().from(deals).where(eq(deals.key, key));
      // A fresh verification attempt is never downgraded back to candidate.
      if (existing && recentlyAttempted(existing, settings, runStartedAt)) {
        out.push(existing);
        continue;
      }
      const values = {
        status: "candidate" as const,
        reasons: ev.reasons,
        discountPct: ev.discountPct,
        belowMaxPct: ev.belowMaxPct,
        amount: o.amount,
        source: o.source,
        stats,
        detectedAt: runStartedAt.toISOString(),
        verifiedAt: null,
        verifyNote: null,
      };
      const [row] = await db
        .insert(deals)
        .values({
          watchId: watch.id,
          routeKey: rk,
          key,
          departDate: o.departDate,
          returnDate: o.returnDate,
          ...values,
        })
        .onConflictDoUpdate({ target: deals.key, set: values })
        .returning();
      if (row) out.push(row);
    }
  }
  return out;
}
