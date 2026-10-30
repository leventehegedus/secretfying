import { applyVerification, pickForVerification } from "@fdw/shared";
import type { Settings, Watch } from "@fdw/shared";
import { eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { deals } from "../db/schema.js";
import type { FlightPriceProvider, ProviderContext } from "../providers/types.js";
import { recentlyAttempted, StatsSnapshot } from "./detection.js";
import type { DealRow } from "./detection.js";
import { mergeStatuses, storeObservations } from "./discovery.js";
import type { StatusMap } from "./discovery.js";

export async function verifyTopDeals(
  db: Db,
  rows: DealRow[],
  watches: Watch[],
  providers: FlightPriceProvider[],
  ctx: ProviderContext,
  settings: Settings,
): Promise<{ verified: number; stale: number; statuses: StatusMap }> {
  const out = { verified: 0, stale: 0, statuses: {} as StatusMap };
  const picked = pickForVerification(rows, settings.verifyTopK, (d) =>
    recentlyAttempted(d, settings, ctx.now()),
  );
  for (const d of picked) {
    const watch = watches.find((w) => w.id === d.watchId);
    const [origin, destination] = d.routeKey.split("-");
    if (!watch || !origin || !destination) continue;
    const q = {
      origin,
      destination,
      departDate: d.departDate,
      returnDate: d.returnDate,
      currency: "EUR" as const,
      maxStops: watch.maxStops,
    };
    const failures: string[] = [];
    for (const p of providers) {
      const r = await p.verify?.(q, ctx);
      if (!r) continue;
      mergeStatuses(out.statuses, { [p.id]: r.ok ? "ok" : r.kind });
      if (!r.ok) {
        failures.push(r.reason);
        continue;
      }
      await storeObservations(db, r.observations);
      const live = r.observations.sort((a, b) => a.amount - b.amount)[0];
      const o = applyVerification({
        candidateAmount: d.amount,
        live: live ? { amount: live.amount, insights: r.insights ?? null } : null,
        maxPrice: watch.maxPrice,
        stats: StatsSnapshot.parse(d.stats),
        settings,
      });
      await db
        .update(deals)
        .set({
          status: o.status,
          amount: o.amount ?? d.amount,
          source: live?.source ?? d.source,
          reasons: o.reasons,
          discountPct: o.discountPct,
          belowMaxPct: o.belowMaxPct,
          verifiedAt: ctx.now().toISOString(),
          verifyNote: o.status === "stale" ? "live price gone or outside tolerance" : null,
        })
        .where(eq(deals.id, d.id));
      out[o.status === "verified" ? "verified" : "stale"]++;
      break;
    }
    if (failures.length === providers.length) {
      // Stays a candidate; verifiedAt stays unset so the next run retries.
      const note = failures.join("; ") || "no verification provider available";
      await db.update(deals).set({ verifyNote: note }).where(eq(deals.id, d.id));
    }
  }
  return out;
}
