import { isAlertable, shouldAlert } from "@fdw/shared";
import type { Settings } from "@fdw/shared";
import { and, desc, eq, isNull } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { alerts, observations } from "../db/schema.js";
import type { DigestDeal } from "../notify/digest.js";
import type { DealRow } from "./detection.js";

const sameDates = (d: DealRow) => [
  eq(alerts.routeKey, d.routeKey),
  eq(alerts.departDate, d.departDate),
  d.returnDate === null ? isNull(alerts.returnDate) : eq(alerts.returnDate, d.returnDate),
];

// Deduped per route+dates across all watches; cheapest first so a pricier twin is suppressed.
export async function pickAlerts(db: Db, rows: DealRow[], settings: Settings): Promise<DealRow[]> {
  const picked = new Map<string, DealRow>();
  for (const d of [...rows].sort((a, b) => a.amount - b.amount)) {
    if (!isAlertable(d.status, settings)) continue;
    const k = `${d.routeKey}|${d.departDate}|${d.returnDate}`;
    const [last] = await db
      .select({ amount: alerts.amount })
      .from(alerts)
      .where(and(...sameDates(d)))
      .orderBy(desc(alerts.sentAt), desc(alerts.id))
      .limit(1);
    const lastAmount = picked.get(k)?.amount ?? last?.amount ?? null;
    if (shouldAlert(d.amount, lastAmount, settings) && !picked.has(k)) picked.set(k, d);
  }
  return [...picked.values()];
}

export async function recordAlerts(db: Db, rows: DealRow[], now: Date): Promise<void> {
  if (rows.length === 0) return;
  await db.insert(alerts).values(
    rows.map((d) => ({
      routeKey: d.routeKey,
      departDate: d.departDate,
      returnDate: d.returnDate,
      amount: d.amount,
      sentAt: now.toISOString(),
    })),
  );
}

export async function toDigestDeals(db: Db, rows: DealRow[]): Promise<DigestDeal[]> {
  return Promise.all(
    rows.map(async (d) => {
      const [origin = "", destination = ""] = d.routeKey.split("-");
      const [o] = await db
        .select({ observedAt: observations.observedAt, deepLink: observations.deepLink })
        .from(observations)
        .where(
          and(
            eq(observations.source, d.source),
            eq(observations.origin, origin),
            eq(observations.destination, destination),
            eq(observations.departDate, d.departDate),
            d.returnDate === null
              ? isNull(observations.returnDate)
              : eq(observations.returnDate, d.returnDate),
          ),
        )
        .orderBy(desc(observations.observedAt))
        .limit(1);
      return {
        origin,
        destination,
        departDate: d.departDate,
        returnDate: d.returnDate,
        amount: d.amount,
        discountPct: d.discountPct,
        belowMaxPct: d.belowMaxPct,
        source: d.source,
        observedAt: o?.observedAt ?? d.detectedAt,
        deepLink: o?.deepLink ?? null,
        status: d.status,
      };
    }),
  );
}
