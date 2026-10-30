import { z } from "zod";
import { getJson } from "./http.js";
import type { ProviderContext } from "./types.js";

const BASE = "https://api.travelpayouts.com/data/en";
const KEY = "iata-places";
const TTL_MS = 7 * 24 * 3600 * 1000;
const Name = z.string().nullish();
const Cities = z.array(
  z.object({ code: z.string(), name: Name, has_flightable_airport: z.boolean() }),
);
const Airports = z.array(z.object({ code: z.string(), name: Name, flightable: z.boolean() }));
const Places = z.array(
  z.object({ code: z.string(), name: z.string(), kind: z.enum(["city", "airport"]) }),
);
export type Place = z.infer<typeof Places>[number];

// Static reference files: no token, not quota-metered, only code+name+kind is cached.
export async function loadPlaces(ctx: ProviderContext): Promise<Place[]> {
  const cached = Places.safeParse(await ctx.cache.get(KEY));
  if (cached.success) return cached.data;
  const get = (file: string) =>
    getJson(`${BASE}/${file}`, { reserve: async () => {}, fetchFn: ctx.fetchFn, sleep: ctx.sleep });
  const cities = Cities.parse(await get("cities.json"));
  const airports = Airports.parse(await get("airports.json"));
  const places: Place[] = [
    ...cities
      .filter((c) => c.has_flightable_airport)
      .map((c) => ({ code: c.code, name: c.name ?? c.code, kind: "city" as const })),
    ...airports
      .filter((a) => a.flightable)
      .map((a) => ({ code: a.code, name: a.name ?? a.code, kind: "airport" as const })),
  ];
  await ctx.cache.set(KEY, places, TTL_MS);
  return places;
}

export async function loadIataCodes(ctx: ProviderContext): Promise<Set<string>> {
  return new Set((await loadPlaces(ctx)).map((p) => p.code));
}
