import { loadConfig } from "./config.js";
import { createDb } from "./db/client.js";
import { createNotifiers } from "./notify/index.js";
import { createCache } from "./providers/cache.js";
import { buildRegistry } from "./providers/registry.js";
import type { ProviderContext } from "./providers/types.js";
import { QuotaGuard } from "./quota/guard.js";
import type { RunDeps } from "./jobs/run.js";

export function createDeps(env: NodeJS.ProcessEnv): RunDeps {
  const cfg = loadConfig(env);
  const db = createDb(cfg.TURSO_DATABASE_URL, cfg.TURSO_AUTH_TOKEN);
  const now = () => new Date();
  const log = (msg: string) => console.log(msg);
  const guard = new QuotaGuard(
    db,
    {
      serpapi: { daily: cfg.QUOTA_SERPAPI_DAILY, monthly: cfg.QUOTA_SERPAPI_MONTHLY },
      travelpayouts: {
        daily: cfg.QUOTA_TRAVELPAYOUTS_DAILY,
        monthly: cfg.QUOTA_TRAVELPAYOUTS_MONTHLY,
      },
    },
    { now, tz: cfg.TZ_SCHEDULE, dryRun: cfg.DRY_RUN },
  );
  const ctx: ProviderContext = { guard, cache: createCache(db, now), log, now };
  return {
    db,
    cfg,
    registry: buildRegistry(cfg, ctx),
    ctx,
    notifiers: createNotifiers(cfg, log),
    now,
  };
}
