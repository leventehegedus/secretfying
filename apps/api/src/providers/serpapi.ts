import { PriceInsights, PriceObservation } from "@fdw/shared";
import { z } from "zod";
import type { Config } from "../config.js";
import { guardedGet } from "./call.js";
import type { FlightPriceProvider, ProviderContext, ProviderResult, VerifyQuery } from "./types.js";

const URL_BASE = "https://serpapi.com/search.json";
const Itinerary = z.object({ price: z.number(), layovers: z.array(z.unknown()).optional() });
const Response_ = z.object({
  best_flights: z.array(Itinerary).optional(),
  other_flights: z.array(Itinerary).optional(),
  price_insights: z
    .object({
      price_level: z.string().optional(),
      typical_price_range: z.array(z.number()).optional(),
    })
    .optional(),
  search_metadata: z.object({ google_flights_url: z.string().optional() }).optional(),
});

export function parseGoogleFlights(
  json: unknown,
  q: VerifyQuery,
  observedAt: string,
): { observation: PriceObservation | null; insights: PriceInsights | null } {
  const r = Response_.parse(json);
  const cheapest = [...(r.best_flights ?? []), ...(r.other_flights ?? [])]
    .map((i) => ({ price: i.price, stops: i.layovers?.length ?? 0 }))
    .filter((i) => i.stops <= q.maxStops)
    .sort((a, b) => a.price - b.price)[0];
  const link = r.search_metadata?.google_flights_url;
  const obs = cheapest
    ? PriceObservation.safeParse({
        source: "serpapi",
        isCached: false,
        observedAt,
        currency: q.currency,
        amount: cheapest.price,
        origin: q.origin,
        destination: q.destination,
        departDate: q.departDate,
        returnDate: q.returnDate,
        stops: cheapest.stops,
        deepLink: link?.startsWith("https://") ? link : undefined,
      })
    : null;
  const pi = r.price_insights;
  const level = PriceInsights.shape.level.safeParse(pi?.price_level);
  return {
    observation: obs?.success ? obs.data : null,
    insights: pi
      ? {
          level: level.success ? level.data : null,
          typicalLow: pi.typical_price_range?.[0] ?? null,
          typicalHigh: pi.typical_price_range?.[1] ?? null,
        }
      : null,
  };
}

// SerpApi `stops`: 1 nonstop only, 2 up to one stop, 0 any. Longer itineraries are filtered locally.
const stopsParam = (maxStops: number) => (maxStops === 0 ? "1" : maxStops === 1 ? "2" : "0");

export function createSerpApi(cfg: Pick<Config, "SERPAPI_KEY">): FlightPriceProvider {
  return {
    id: "serpapi",
    async verify(q: VerifyQuery, ctx: ProviderContext): Promise<ProviderResult> {
      if (!cfg.SERPAPI_KEY) return { ok: false, kind: "unavailable", reason: "no api key" };
      const p = new URLSearchParams({
        engine: "google_flights",
        departure_id: q.origin,
        arrival_id: q.destination,
        outbound_date: q.departDate,
        type: q.returnDate ? "1" : "2",
        currency: q.currency,
        hl: "en",
        stops: stopsParam(q.maxStops),
        api_key: cfg.SERPAPI_KEY,
      });
      if (q.returnDate) p.set("return_date", q.returnDate);
      const res = await guardedGet(ctx, "serpapi", "verify", `${URL_BASE}?${p}`, {
        redact: ["api_key"],
      });
      if (!res.ok) return res;
      try {
        const { observation, insights } = parseGoogleFlights(res.json, q, ctx.now().toISOString());
        return {
          ok: true,
          observations: observation ? [observation] : [],
          ...(insights && { insights }),
          dropped: 0,
        };
      } catch {
        return { ok: false, kind: "unavailable", reason: "unexpected response shape" };
      }
    },
  };
}
