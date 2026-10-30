import type { ProviderId } from "@fdw/shared";
import { and, eq, sql } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { quotaLedger } from "../db/schema.js";

export type QuotaRefusalKind = "quota_exhausted" | "dry_run";
type Metered = Exclude<ProviderId, "fixture">;
export type QuotaCaps = Record<Metered, { daily: number; monthly: number }>;
export type QuotaUsage = { dayUsed: number; dayCap: number; monthUsed: number; monthCap: number };
export type Reservation =
  { ok: true; id: number } | { ok: false; kind: QuotaRefusalKind; reason: string };
type Opts = { now: () => Date; tz: string; dryRun: boolean };

export class QuotaGuard {
  private chain: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly db: Db,
    private readonly caps: QuotaCaps,
    private readonly opts: Opts,
  ) {}

  private today(): { day: string; month: string } {
    // en-CA formats as YYYY-MM-DD
    const day = new Intl.DateTimeFormat("en-CA", {
      timeZone: this.opts.tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(this.opts.now());
    return { day, month: day.slice(0, 7) };
  }

  private async usage(db: Pick<Db, "select">, p: Metered): Promise<QuotaUsage> {
    const { day, month } = this.today();
    const count = async (col: "day" | "month", v: string) => {
      const [r] = await db
        .select({ n: sql<number>`count(*)` })
        .from(quotaLedger)
        .where(and(eq(quotaLedger.provider, p), eq(quotaLedger[col], v)));
      return r?.n ?? 0;
    };
    return {
      dayUsed: await count("day", day),
      dayCap: this.caps[p].daily,
      monthUsed: await count("month", month),
      monthCap: this.caps[p].monthly,
    };
  }

  remaining(p: ProviderId): Promise<QuotaUsage> {
    if (p === "fixture")
      return Promise.resolve({ dayUsed: 0, dayCap: 0, monthUsed: 0, monthCap: 0 });
    return this.usage(this.db, p);
  }

  reserve(p: ProviderId, kind: "discover" | "verify", runId?: number): Promise<Reservation> {
    if (p === "fixture") return Promise.resolve({ ok: true, id: 0 });
    if (this.opts.dryRun) {
      return Promise.resolve({ ok: false, kind: "dry_run", reason: "DRY_RUN is enabled" });
    }
    // Mutex serialises in-process callers; IMMEDIATE covers other instances.
    const run = this.chain.then(() =>
      this.db.transaction(
        async (tx): Promise<Reservation> => {
          const u = await this.usage(tx, p);
          if (u.dayUsed >= u.dayCap || u.monthUsed >= u.monthCap) {
            return { ok: false, kind: "quota_exhausted", reason: `${p} quota exhausted` };
          }
          const { day, month } = this.today();
          const [row] = await tx
            .insert(quotaLedger)
            .values({
              provider: p,
              kind,
              at: this.opts.now().toISOString(),
              day,
              month,
              status: "reserved",
              runId: runId ?? null,
            })
            .returning({ id: quotaLedger.id });
          if (!row) throw new Error("quota insert failed");
          return { ok: true, id: row.id };
        },
        { behavior: "immediate" },
      ),
    );
    this.chain = run.catch(() => undefined);
    return run;
  }

  async settle(id: number, status: "ok" | "error"): Promise<void> {
    if (id === 0) return;
    await this.db.update(quotaLedger).set({ status }).where(eq(quotaLedger.id, id));
  }
}
