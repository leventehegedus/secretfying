import type { ProviderId, ProviderStatus } from "@fdw/shared";
import type { Config } from "../config.js";
import { createFixtureProvider } from "./fixture.js";
import { createSerpApi } from "./serpapi.js";
import { createTravelpayouts } from "./travelpayouts.js";
import type { FlightPriceProvider, ProviderContext } from "./types.js";

export type Registry = {
  discovery: FlightPriceProvider[];
  verification: FlightPriceProvider[];
  statuses: Record<ProviderId, ProviderStatus>;
};

export function buildRegistry(cfg: Config, ctx: Pick<ProviderContext, "log">): Registry {
  const fixture = createFixtureProvider();
  if (cfg.DRY_RUN) {
    return {
      discovery: [fixture],
      verification: [fixture],
      statuses: { travelpayouts: "dry_run", serpapi: "dry_run", fixture: "ok" },
    };
  }
  const available: Partial<Record<ProviderId, FlightPriceProvider>> = {};
  if (cfg.TRAVELPAYOUTS_TOKEN) available.travelpayouts = createTravelpayouts(cfg);
  if (cfg.SERPAPI_KEY) available.serpapi = createSerpApi(cfg);
  const pick = (ids: ProviderId[]) =>
    ids.flatMap((id) => {
      const p = available[id];
      if (!p) ctx.log(`provider ${id} disabled: missing key or not available`);
      return p ? [p] : [];
    });
  const discovery = pick(cfg.DISCOVERY_PROVIDERS).filter((p) => p.discover);
  const verification = pick(cfg.VERIFY_PROVIDERS).filter((p) => p.verify);
  const used = new Set([...discovery, ...verification].map((p) => p.id));
  const status = (id: ProviderId): ProviderStatus => (used.has(id) ? "ok" : "disabled");
  return {
    discovery,
    verification,
    statuses: {
      travelpayouts: status("travelpayouts"),
      serpapi: status("serpapi"),
      fixture: "disabled",
    },
  };
}
