import type { PriceObservation } from "@fdw/shared";
import { z } from "zod";
import type { Config } from "../config.js";
import { guardedGet } from "./call.js";
import { normalize } from "./normalize.js";
import type {
  DiscoverQuery,
  FlightPriceProvider,
  ProviderContext,
  ProviderResult,
} from "./types.js";

const BASE = "https://api.travelpayouts.com";
export const PRICES_FOR_DATES = `${BASE}/aviasales/v3/prices_for_dates`;
// 20 h, not 24: the next daily cron run must never read yesterday's response as today's price.
const TTL_MS = 20 * 3600 * 1000;

// Lenient envelope: unknown extra fields are fine; rows are validated one by one.
const Envelope = z.object({
  success: z.boolean().optional(),
  currency: z.string().optional(),
  data: z.array(z.unknown()),
});
const Row = z.object({
  origin: z.string(),
  destination: z.string(),
  origin_airport: z.string().nullish(),
  destination_airport: z.string().nullish(),
  price: z.number(),
  departure_at: z.string(),
  return_at: z.string().nullish(),
  transfers: z.number(),
  return_transfers: z.number().nullish(),
  link: z.string().optional(),
});

// Rows carry the city code plus the airport. A watch may name either (LON or BGY), so a row is
// labelled with the queried code when its city or airport matches, and skipped otherwise.
function asQueried(want: string, city: string, airport?: string | null): string | undefined {
  if (want === "ANYWHERE") return city;
  return want === city || want === airport ? want : undefined;
}

export function parsePricesForDates(
  json: unknown,
  opts: {
    observedAt: string;
    market: string;
    route: Pick<DiscoverQuery, "origin" | "destination">;
    log: (msg: string) => void;
  },
): { observations: PriceObservation[]; dropped: number } {
  const env = Envelope.parse(json);
  const currency = env.currency?.toUpperCase();
  const rows = env.data.flatMap((raw) => {
    const r = Row.safeParse(raw);
    if (!r.success) return [null]; // normalize() drops and counts it
    const d = r.data;
    const origin = asQueried(opts.route.origin, d.origin, d.origin_airport);
    const destination = asQueried(opts.route.destination, d.destination, d.destination_airport);
    if (!origin || !destination) return []; // another airport of the city: not this watch
    return [
      {
        source: "travelpayouts",
        isCached: true,
        observedAt: opts.observedAt,
        currency,
        amount: d.price,
        origin,
        destination,
        departDate: d.departure_at.slice(0, 10),
        returnDate: d.return_at ? d.return_at.slice(0, 10) : null,
        stops: Math.max(d.transfers, d.return_transfers ?? 0),
        deepLink: d.link ? `https://www.aviasales.com${d.link}` : undefined,
        market: opts.market,
      },
    ];
  });
  return normalize(rows, opts.log);
}

export function buildPricesUrl(q: DiscoverQuery): string {
  const p = new URLSearchParams({ origin: q.origin });
  if (q.destination !== "ANYWHERE") p.set("destination", q.destination);
  p.set("departure_at", q.month);
  if (q.tripType === "return") p.set("return_at", q.month);
  p.set("one_way", String(q.tripType === "oneway"));
  p.set("direct", "false");
  p.set("currency", "eur");
  p.set("market", q.market);
  p.set("sorting", "price");
  p.set("unique", "false");
  p.set("limit", "100");
  return `${PRICES_FOR_DATES}?${p}`;
}

export function createTravelpayouts(
  cfg: Pick<Config, "TRAVELPAYOUTS_TOKEN" | "TRAVELPAYOUTS_MIN_INTERVAL_MS">,
): FlightPriceProvider {
  let lastCall = 0;
  return {
    id: "travelpayouts",
    async discover(q: DiscoverQuery, ctx: ProviderContext): Promise<ProviderResult> {
      const token = cfg.TRAVELPAYOUTS_TOKEN;
      if (!token) return { ok: false, kind: "unavailable", reason: "no token" };
      const url = buildPricesUrl(q); // token is a header, so the URL is a safe cache key
      let json = await ctx.cache.get(url);
      if (json === undefined) {
        const wait = lastCall + cfg.TRAVELPAYOUTS_MIN_INTERVAL_MS - ctx.now().getTime();
        if (wait > 0) await (ctx.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms))))(wait);
        const res = await guardedGet(ctx, "travelpayouts", "discover", url, {
          headers: { "X-Access-Token": token },
        });
        lastCall = ctx.now().getTime();
        if (!res.ok) return res;
        json = res.json;
        try {
          Envelope.parse(json);
        } catch {
          return { ok: false, kind: "unavailable", reason: "unexpected response shape" };
        }
        await ctx.cache.set(url, json, TTL_MS);
      }
      try {
        const { observations, dropped } = parsePricesForDates(json, {
          observedAt: ctx.now().toISOString(),
          market: q.market,
          route: q,
          log: ctx.log,
        });
        return { ok: true, observations, dropped };
      } catch {
        return { ok: false, kind: "unavailable", reason: "unexpected response shape" };
      }
    },
  };
}
