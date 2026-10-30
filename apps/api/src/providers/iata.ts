import { z } from "zod";
import { getJson } from "./http.js";
import type { ProviderContext } from "./types.js";

const BASE = "https://api.travelpayouts.com/data/en";
const KEY = "iata-codes";
const TTL_MS = 7 * 24 * 3600 * 1000;
const Cities = z.array(z.object({ code: z.string(), has_flightable_airport: z.boolean() }));
const Airports = z.array(z.object({ code: z.string(), flightable: z.boolean() }));

// Static reference files: no token, not quota-metered, only the code list is cached.
export async function loadIataCodes(ctx: ProviderContext): Promise<Set<string>> {
  const cached = z.array(z.string()).safeParse(await ctx.cache.get(KEY));
  if (cached.success) return new Set(cached.data);
  const get = (file: string) =>
    getJson(`${BASE}/${file}`, { reserve: async () => {}, fetchFn: ctx.fetchFn, sleep: ctx.sleep });
  const cities = Cities.parse(await get("cities.json"));
  const airports = Airports.parse(await get("airports.json"));
  const codes = [
    ...cities.filter((c) => c.has_flightable_airport),
    ...airports.filter((a) => a.flightable),
  ].map((x) => x.code);
  await ctx.cache.set(KEY, codes, TTL_MS);
  return new Set(codes);
}
