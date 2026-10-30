import { DEFAULT_SETTINGS, Settings } from "@fdw/shared";
import type { ProviderId } from "@fdw/shared";
import { and, eq, gte, inArray } from "drizzle-orm";
import { z } from "zod";
import type { Config } from "../config.js";
import type { Db } from "../db/client.js";
import { deals, runs, settings as settingsTable, watches } from "../db/schema.js";
import type { ProviderContext } from "../providers/types.js";
import type { Registry } from "../providers/registry.js";
import { buildDigest } from "../notify/digest.js";
import type { DigestInput } from "../notify/digest.js";
import type { Notifier } from "../notify/index.js";
import { pickAlerts, recordAlerts, toDigestDeals } from "../services/alerting.js";
import { detectDeals } from "../services/detection.js";
import { discoverForWatch, mergeStatuses } from "../services/discovery.js";
import type { StatusMap } from "../services/discovery.js";
import { verifyTopDeals } from "../services/verification.js";
import { toWatch } from "../services/watches.js";
import { dayIn } from "../util/time.js";

export type RunDeps = {
  db: Db;
  cfg: Config;
  registry: Registry;
  ctx: ProviderContext;
  notifiers: Notifier[];
  now: () => Date;
};
export type RunSummary = {
  watches: number;
  queries: number;
  stored: number;
  dropped: number;
  deals: number;
  verified: number;
  stale: number;
  alerts: number;
  notify: "sent" | "skipped" | "failed" | "none";
  notifyError?: string;
  error?: string;
  deadline?: boolean;
  providers: StatusMap;
  quota: DigestInput["quota"];
};
export type RunResult =
  | { ok: false; reason: "already_running" }
  | { ok: true; runId: number; status: "done" | "failed"; summary: RunSummary };

const LOCK_MS = 6 * 60_000;
const RUN_DEADLINE_MS = 240_000; // Vercel kills the function at 300 s
const METERED: ProviderId[] = ["travelpayouts", "serpapi"];

async function acquire(db: Db, now: Date): Promise<number | null> {
  return db.transaction(
    async (tx) => {
      let busy = false;
      for (const r of await tx.select().from(runs).where(eq(runs.status, "running"))) {
        if (now.getTime() - Date.parse(r.startedAt) < LOCK_MS) busy = true;
        else {
          await tx
            .update(runs)
            .set({
              status: "failed",
              finishedAt: now.toISOString(),
              summary: { error: "stale lock" },
            })
            .where(eq(runs.id, r.id));
        }
      }
      if (busy) return null;
      const [row] = await tx
        .insert(runs)
        .values({ status: "running", startedAt: now.toISOString() })
        .returning({ id: runs.id });
      return row?.id ?? null;
    },
    { behavior: "immediate" },
  );
}

export async function loadSettings(db: Db): Promise<Settings> {
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.id, 1));
  const r = Settings.safeParse(row?.json);
  return r.success ? r.data : DEFAULT_SETTINGS;
}

async function digestSentToday(db: Db, now: Date, tz: string): Promise<boolean> {
  const since = new Date(now.getTime() - 48 * 3_600_000).toISOString();
  const rows = await db
    .select()
    .from(runs)
    .where(and(eq(runs.status, "done"), gte(runs.startedAt, since)));
  const Notified = z.object({ notify: z.literal("sent") });
  return rows.some(
    (r) =>
      dayIn(tz, new Date(r.startedAt)) === dayIn(tz, now) && Notified.safeParse(r.summary).success,
  );
}

async function execute(d: RunDeps, startedAt: Date, s: RunSummary): Promise<void> {
  const { db, cfg, registry, ctx, notifiers } = d;
  const settings = await loadSettings(db);
  const active = (await db.select().from(watches).where(eq(watches.active, true))).map(toWatch);
  s.watches = active.length;
  Object.assign(s.providers, registry.statuses);

  const budget = { left: cfg.MAX_DISCOVERY_CALLS_PER_RUN };
  const limits = { deadline: startedAt.getTime() + RUN_DEADLINE_MS, down: new Set<ProviderId>() };
  const found = [];
  for (const watch of active) {
    const r = await discoverForWatch(db, watch, registry.discovery, ctx, {
      market: cfg.TRAVELPAYOUTS_MARKET,
      budget,
      tz: cfg.TZ_SCHEDULE,
      limits,
    });
    s.queries += r.queries;
    s.stored += r.stored.length;
    s.dropped += r.dropped;
    mergeStatuses(s.providers, r.statuses);
    if (r.deadline) s.deadline = true;
    found.push({ watch, observations: r.stored });
  }

  const detected = await detectDeals(db, found, startedAt, settings);
  s.deals = detected.length;
  const v = await verifyTopDeals(
    db,
    detected,
    active,
    registry.verification,
    ctx,
    settings,
    limits,
  );
  s.verified = v.verified;
  s.stale = v.stale;
  if (v.deadline) s.deadline = true;
  mergeStatuses(s.providers, v.statuses);

  for (const p of METERED) {
    if (s.providers[p] === "disabled") continue;
    const u = await ctx.guard.remaining(p);
    s.quota[p] = { dayLeft: u.dayCap - u.dayUsed, monthLeft: u.monthCap - u.monthUsed };
  }

  const ids = detected.map((r) => r.id);
  const fresh = ids.length ? await db.select().from(deals).where(inArray(deals.id, ids)) : [];
  const toAlert = await pickAlerts(db, fresh, settings);
  s.alerts = toAlert.length;
  if (notifiers.length === 0) s.notify = "none";
  else if (toAlert.length === 0 && (await digestSentToday(db, startedAt, cfg.TZ_SCHEDULE))) {
    s.notify = "skipped";
  } else {
    const msg = buildDigest(
      {
        date: dayIn(cfg.TZ_SCHEDULE, startedAt),
        now: startedAt,
        deals: await toDigestDeals(db, toAlert),
        quota: s.quota,
        statuses: s.providers,
      },
      settings.language,
    );
    try {
      for (const n of notifiers) await n.send(msg);
      s.notify = "sent";
      await recordAlerts(db, toAlert, startedAt);
    } catch (e) {
      s.notify = "failed";
      s.notifyError = e instanceof Error ? e.message : "notify failed";
      ctx.log(`notify failed: ${s.notifyError}`);
    }
  }
}

export async function runOnce(d: RunDeps): Promise<RunResult> {
  const startedAt = d.now();
  const runId = await acquire(d.db, startedAt);
  if (runId === null) return { ok: false, reason: "already_running" };
  const summary: RunSummary = {
    watches: 0,
    queries: 0,
    stored: 0,
    dropped: 0,
    deals: 0,
    verified: 0,
    stale: 0,
    alerts: 0,
    notify: "none",
    providers: {},
    quota: {},
  };
  let status: "done" | "failed" = "done";
  try {
    await execute(d, startedAt, summary);
  } catch (e) {
    status = "failed";
    summary.error = e instanceof Error ? e.message : "run failed";
    d.ctx.log(`run failed: ${summary.error}`);
  }
  await d.db
    .update(runs)
    .set({ status, finishedAt: d.now().toISOString(), summary })
    .where(eq(runs.id, runId));
  return { ok: true, runId, status, summary };
}
