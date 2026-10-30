import { vi } from "vitest";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";
import type { Notifier } from "../notify/index.js";
import airports from "../providers/fixtures/travelpayouts-airports.json" with { type: "json" };
import cities from "../providers/fixtures/travelpayouts-cities.json" with { type: "json" };
import { buildRegistry } from "../providers/registry.js";
import { jsonRes, NOW, testCtx } from "../providers/testkit.js";

// Offline: only the static IATA reference files exist; any other URL fails.
const fakeFetch = vi.fn<typeof fetch>(async (u) => {
  const url = String(u);
  if (url.endsWith("cities.json")) return jsonRes(cities);
  if (url.endsWith("airports.json")) return jsonRes(airports);
  return jsonRes({}, 500);
});

export async function testApp(
  opts: { env?: Record<string, string>; notifiers?: Notifier[]; cap?: number } = {},
) {
  const cfg = loadConfig({ DRY_RUN: "true", LOG_LEVEL: "fatal", ...opts.env });
  const t = await testCtx(fakeFetch, { cap: opts.cap });
  const deps = {
    db: t.db,
    cfg,
    registry: buildRegistry(cfg, t.ctx),
    ctx: t.ctx,
    notifiers: opts.notifiers ?? [],
    now: () => NOW,
  };
  return { app: buildApp(deps), db: t.db };
}
