import type { PriceObservation, ProviderId, ProviderStatus, Watch } from "@fdw/shared";
import { sql } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { observationKey } from "../db/keys.js";
import { observations } from "../db/schema.js";
import type { FlightPriceProvider, ProviderContext } from "../providers/types.js";
import { matchesWatch, watchMonths } from "./watches.js";

export type StatusMap = Partial<Record<ProviderId, ProviderStatus>>;
export type Budget = { left: number };

// A failure is never hidden by a later success.
export function mergeStatuses(acc: StatusMap, add: StatusMap): void {
  for (const [id, s] of Object.entries(add) as [ProviderId, ProviderStatus][]) {
    const cur = acc[id];
    if (cur === undefined || cur === "ok" || cur === "disabled") acc[id] = s;
  }
}

// One row per key (source, route, dates, currency, day); the latest price wins.
export async function storeObservations(db: Db, obs: PriceObservation[]): Promise<void> {
  if (obs.length === 0) return;
  const rows = obs.map((o) => {
    const observedDay = o.observedAt.slice(0, 10);
    return {
      ...o,
      observedDay,
      key: observationKey({ ...o, observedDay }),
      expiresAt: o.expiresAt ?? null,
      deepLink: o.deepLink ?? null,
      market: o.market ?? null,
    };
  });
  await db
    .insert(observations)
    .values(rows)
    .onConflictDoUpdate({
      target: observations.key,
      set: {
        amount: sql`excluded.amount`,
        observedAt: sql`excluded.observed_at`,
        stops: sql`excluded.stops`,
        isCached: sql`excluded.is_cached`,
        expiresAt: sql`excluded.expires_at`,
        deepLink: sql`excluded.deep_link`,
        market: sql`excluded.market`,
      },
    });
}

export async function discoverForWatch(
  db: Db,
  w: Watch,
  providers: FlightPriceProvider[],
  ctx: ProviderContext,
  opts: { market: string; budget: Budget; tz: string },
): Promise<{ stored: PriceObservation[]; dropped: number; queries: number; statuses: StatusMap }> {
  const out = {
    stored: [] as PriceObservation[],
    dropped: 0,
    queries: 0,
    statuses: {} as StatusMap,
  };
  for (const month of watchMonths(w, ctx.now(), opts.tz)) {
    if (opts.budget.left <= 0) break;
    opts.budget.left--;
    out.queries++;
    const q = {
      origin: w.origin,
      destination: w.destination,
      month,
      tripType: w.tripType,
      currency: "EUR" as const,
      market: opts.market,
    };
    for (const p of providers) {
      const r = await p.discover?.(q, ctx);
      if (!r) continue;
      // A failure is never hidden by an earlier success.
      if (!r.ok || !out.statuses[p.id]) out.statuses[p.id] = r.ok ? "ok" : r.kind;
      if (!r.ok) continue;
      out.dropped += r.dropped;
      out.stored.push(...r.observations.filter((o) => matchesWatch(o, w)));
      break;
    }
  }
  await storeObservations(db, out.stored);
  return out;
}
