import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { loadConfig } from "../config.js";
import { alerts, runs } from "../db/schema.js";
import { createNotifiers } from "../notify/index.js";
import type { Notifier } from "../notify/index.js";
import serp from "../providers/fixtures/serpapi-google-flights.json" with { type: "json" };
import { buildRegistry } from "../providers/registry.js";
import { jsonRes, NOW, testCtx } from "../providers/testkit.js";
import { insertWatch, watch } from "../test/builders.js";
import { runOnce } from "./run.js";
import type { RunDeps } from "./run.js";

const TP = {
  currency: "eur",
  data: [
    {
      origin: "BUD",
      destination: "LIS",
      price: 115,
      departure_at: "2026-12-05T06:15:00+01:00",
      return_at: "2026-12-10T14:40:00+00:00",
      transfers: 0,
      link: "/x",
    },
  ],
};
const cfg = loadConfig({
  TRAVELPAYOUTS_TOKEN: "t",
  SERPAPI_KEY: "s",
  TRAVELPAYOUTS_MIN_INTERVAL_MS: "0",
});
const W = watch({ monthsAhead: 1, maxPrice: 120 });

async function setup(opts: { serpapiCap?: number; watches?: boolean; notifier?: Notifier } = {}) {
  const fetchFn = vi.fn(async (u: string | URL | Request) =>
    String(u).includes("travelpayouts") ? jsonRes(TP) : jsonRes(serp),
  );
  const t = await testCtx(fetchFn, { serpapiCap: opts.serpapiCap });
  if (opts.watches !== false) await insertWatch(t.db, W);
  const send = vi.fn(async () => {});
  const notifier = opts.notifier ?? { name: "fake", send };
  const deps: RunDeps = {
    db: t.db,
    cfg,
    registry: buildRegistry(cfg, t.ctx),
    ctx: t.ctx,
    notifiers: [notifier],
    now: () => NOW,
  };
  return { ...t, deps, fetchFn, send };
}

describe("runOnce", () => {
  it("discovers, verifies and sends one digest", async () => {
    const { deps, send, db } = await setup();
    const r = await runOnce(deps);
    expect(r).toMatchObject({ ok: true, status: "done" });
    if (!r.ok) return;
    expect(r.summary).toMatchObject({
      watches: 1,
      queries: 1,
      stored: 1,
      deals: 1,
      verified: 1,
      alerts: 1,
      notify: "sent",
    });
    expect(r.summary.quota.serpapi).toEqual({ dayLeft: 99, monthLeft: 99 });
    expect(send).toHaveBeenCalledTimes(1);
    const [row] = await db.select().from(runs);
    expect(row?.status).toBe("done");
  });

  it("second run the same day makes no provider calls and sends nothing", async () => {
    const { deps, send, fetchFn } = await setup();
    await runOnce(deps);
    const calls = fetchFn.mock.calls.length;
    const r = await runOnce({ ...deps, now: () => new Date(NOW.getTime() + 3_600_000) });
    expect(fetchFn.mock.calls.length).toBe(calls);
    expect(r).toMatchObject({ ok: true, summary: { alerts: 0, notify: "skipped" } });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("sends 'ma nincs akció' once per day when nothing was found", async () => {
    const { deps, send } = await setup({ watches: false });
    await runOnce(deps);
    const again = await runOnce({ ...deps, now: () => new Date(NOW.getTime() + 60_000) });
    expect(send).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(send.mock.calls[0])).toContain("ma nincs akció");
    expect(again).toMatchObject({ ok: true, summary: { notify: "skipped" } });
  });

  it("refuses an overlapping run and recovers a stale lock", async () => {
    const { deps, db } = await setup();
    await db
      .insert(runs)
      .values({ status: "running", startedAt: new Date(NOW.getTime() - 5 * 60_000).toISOString() });
    expect(await runOnce(deps)).toEqual({ ok: false, reason: "already_running" });
    await db.update(runs).set({ startedAt: new Date(NOW.getTime() - 40 * 60_000).toISOString() });
    expect(await runOnce(deps)).toMatchObject({ ok: true, status: "done" });
    const [old] = await db.select().from(runs).where(eq(runs.id, 1));
    expect(old?.status).toBe("failed");
  });

  it("keeps the deal a candidate with a note when serpapi quota is exhausted", async () => {
    const { deps, db } = await setup({ serpapiCap: 0 });
    const r = await runOnce(deps);
    if (!r.ok) throw new Error("refused");
    expect(r.summary).toMatchObject({
      verified: 0,
      deals: 1,
      providers: { serpapi: "quota_exhausted" },
    });
    const [d] = await db.query.deals.findMany();
    expect(d).toMatchObject({ status: "candidate", verifiedAt: null });
    expect(d?.verifyNote).toContain("quota");
  });

  it("two watches finding the same route and dates produce one alert", async () => {
    const { deps, db, send } = await setup();
    await insertWatch(db, watch({ id: 2, destination: "ANYWHERE", monthsAhead: 1, maxPrice: 120 }));
    const r = await runOnce(deps);
    if (!r.ok) throw new Error("refused");
    expect(r.summary).toMatchObject({ deals: 2, alerts: 1 });
    expect(await db.select().from(alerts)).toHaveLength(1);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("Telegram 500 leaves the run done with notify failed and no token leak", async () => {
    const token = "999:SECRET-token";
    const telegram = vi.fn(async () => new Response("down", { status: 500 }));
    const [n] = createNotifiers(
      { TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHAT_ID: "1" },
      () => {},
      telegram,
    );
    const { deps, db, log } = await setup({ notifier: n });
    const r = await runOnce(deps);
    expect(r).toMatchObject({ ok: true, status: "done", summary: { notify: "failed" } });
    const [row] = await db.select().from(runs);
    expect(JSON.stringify(row) + log.mock.calls.join("\n")).not.toContain("SECRET");
    expect(await db.select().from(alerts)).toHaveLength(0);
  });
});
