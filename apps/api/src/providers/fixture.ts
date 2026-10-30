import serp from "./fixtures/serpapi-google-flights.json" with { type: "json" };
import tp from "./fixtures/travelpayouts-prices-for-dates.json" with { type: "json" };
import { parseGoogleFlights } from "./serpapi.js";
import { parsePricesForDates } from "./travelpayouts.js";
import type { FlightPriceProvider } from "./types.js";

const DAY = 86_400_000;
const DATETIME = /^\d{4}-\d{2}-\d{2}T/;
const addDays = (date: string, n: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);

function mapDateTimes(v: unknown, f: (s: string) => string): unknown {
  if (typeof v === "string") return DATETIME.test(v) ? f(v) : v;
  if (Array.isArray(v)) return v.map((x) => mapDateTimes(x, f));
  if (v && typeof v === "object")
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, mapDateTimes(x, f)]));
  return v;
}

// Demo data must not expire: shift so the earliest departure is 30 days after `now`.
function shiftedTp(now: Date): unknown {
  const first = Object.values(tp.data)
    .map((r) => r.departure_at.slice(0, 10))
    .sort()[0];
  if (!first) return tp;
  const target = new Date(now.getTime() + 30 * DAY).toISOString().slice(0, 10);
  const days = Math.round((Date.parse(target) - Date.parse(first)) / DAY);
  return mapDateTimes(tp, (s) => addDays(s.slice(0, 10), days) + s.slice(10));
}

const asFixture = <T extends { source: string }>(o: T): T => ({ ...o, source: "fixture" });

// Only registered when DRY_RUN is on; never produces data otherwise.
export function createFixtureProvider(): FlightPriceProvider {
  return {
    id: "fixture",
    async discover(q, ctx) {
      const { observations, dropped } = parsePricesForDates(shiftedTp(ctx.now()), {
        observedAt: ctx.now().toISOString(),
        market: q.market,
        log: ctx.log,
      });
      const wanted = observations.filter(
        (o) =>
          o.origin === q.origin &&
          (q.destination === "ANYWHERE" || o.destination === q.destination) &&
          (o.returnDate === null) === (q.tripType === "oneway"),
      );
      return { ok: true, observations: wanted.map(asFixture), dropped };
    },
    async verify(q, ctx) {
      const { observation, insights } = parseGoogleFlights(serp, q, ctx.now().toISOString());
      return {
        ok: true,
        observations: observation ? [asFixture(observation)] : [],
        ...(insights && { insights }),
        dropped: 0,
      };
    },
  };
}
