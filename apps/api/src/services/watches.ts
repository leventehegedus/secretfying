import { Watch } from "@fdw/shared";
import type { PriceObservation, WatchInput } from "@fdw/shared";
import type { watches } from "../db/schema.js";
import { dayIn } from "../util/time.js";

const DAY_MS = 86_400_000;

export const toWatch = (r: typeof watches.$inferSelect): Watch =>
  Watch.parse({
    ...r,
    departFrom: r.departFrom ?? undefined,
    departTo: r.departTo ?? undefined,
    minStay: r.minStay ?? undefined,
    maxStay: r.maxStay ?? undefined,
    maxPrice: r.maxPrice,
  });

// "2026-11" -> "2026-12"; Date.UTC rolls month 12 over into January of the next year.
const nextMonth = (m: string): string =>
  new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 1)).toISOString().slice(0, 7);

export function watchMonths(w: Watch, now: Date, tz: string): string[] {
  const start = w.departFrom?.slice(0, 7) ?? dayIn(tz, now).slice(0, 7);
  const end = w.departTo?.slice(0, 7);
  const out: string[] = [];
  for (let m = start; end ? m <= end : out.length < w.monthsAhead; m = nextMonth(m)) out.push(m);
  return out;
}

export function matchesWatch(o: PriceObservation, w: Watch): boolean {
  if (w.departFrom && o.departDate < w.departFrom) return false;
  if (w.departTo && o.departDate > w.departTo) return false;
  if ((o.returnDate === null) !== (w.tripType === "oneway")) return false;
  if (o.stops > w.maxStops) return false;
  if (o.returnDate) {
    const stay = (Date.parse(o.returnDate) - Date.parse(o.departDate)) / DAY_MS;
    if (w.minStay !== undefined && stay < w.minStay) return false;
    if (w.maxStay !== undefined && stay > w.maxStay) return false;
  }
  return true;
}

export const toRow = (w: WatchInput) => ({
  ...w,
  departFrom: w.departFrom ?? null,
  departTo: w.departTo ?? null,
  minStay: w.minStay ?? null,
  maxStay: w.maxStay ?? null,
});
