import { vi } from "vitest";
import { QuotaGuard } from "../quota/guard.js";
import { testDb } from "../test/db.js";
import { createCache } from "./cache.js";
import type { ProviderContext } from "./types.js";

export const NOW = new Date("2026-10-30T10:00:00Z");

export const jsonRes = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export async function testCtx(
  fetchFn: typeof fetch,
  opts: { dryRun?: boolean; cap?: number } = {},
) {
  const db = await testDb();
  const cap = { daily: opts.cap ?? 100, monthly: opts.cap ?? 100 };
  const guard = new QuotaGuard(
    db,
    { serpapi: cap, travelpayouts: cap },
    { now: () => NOW, tz: "Europe/Budapest", dryRun: opts.dryRun ?? false },
  );
  const log = vi.fn<(msg: string) => void>();
  const ctx: ProviderContext = {
    guard,
    cache: createCache(db, () => NOW),
    log,
    now: () => NOW,
    fetchFn,
    sleep: async () => {},
  };
  return { ctx, guard, log };
}
