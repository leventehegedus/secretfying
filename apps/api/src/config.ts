import { ProviderId } from "@fdw/shared";
import { z } from "zod";

const bool = z.enum(["true", "false"]).transform((v) => v === "true");
const providers = z
  .string()
  .transform((v) =>
    v
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  )
  .pipe(z.array(ProviderId));
const int = (def: number) => z.coerce.number().int().min(0).default(def);

const Env = z.object({
  TURSO_DATABASE_URL: z.string().min(1).default("file:./data/fdw.db"),
  TURSO_AUTH_TOKEN: z.string().min(1).optional(),
  DRY_RUN: bool.default(false),
  TZ_SCHEDULE: z.string().min(1).default("Europe/Budapest"),
  DISCOVERY_PROVIDERS: providers.default(["travelpayouts"]),
  VERIFY_PROVIDERS: providers.default(["serpapi"]),
  TRAVELPAYOUTS_TOKEN: z.string().min(1).optional(),
  TRAVELPAYOUTS_MARKET: z.string().min(1).default("hu"),
  TRAVELPAYOUTS_MIN_INTERVAL_MS: int(1000),
  SERPAPI_KEY: z.string().min(1).optional(),
  QUOTA_SERPAPI_DAILY: int(15),
  QUOTA_SERPAPI_MONTHLY: int(200),
  QUOTA_TRAVELPAYOUTS_DAILY: int(500),
  QUOTA_TRAVELPAYOUTS_MONTHLY: int(10000),
  MAX_DISCOVERY_CALLS_PER_RUN: int(60),
  TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
  TELEGRAM_CHAT_ID: z.string().min(1).optional(),
  API_TOKEN: z.string().min(1).optional(),
  CRON_SECRET: z.string().min(1).optional(),
  PORT: int(3000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});
export type Config = z.infer<typeof Env>;

export function loadConfig(env: NodeJS.ProcessEnv): Config {
  // Empty values (KEY= in .env files) mean "unset".
  const r = Env.safeParse(Object.fromEntries(Object.entries(env).filter(([, v]) => v !== "")));
  if (r.success) return r.data;
  const keys = [...new Set(r.error.issues.map((i) => String(i.path[0])))];
  throw new Error(`Invalid configuration: ${keys.join(", ")}`);
}
