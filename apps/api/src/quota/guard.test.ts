import { describe, expect, it } from "vitest";
import { testDb } from "../test/db.js";
import { QuotaGuard, type QuotaCaps } from "./guard.js";

const caps = (daily: number, monthly: number): QuotaCaps => ({
  serpapi: { daily, monthly },
  travelpayouts: { daily, monthly },
});

async function setup(c: QuotaCaps, start: string, dryRun = false) {
  const clock = { t: new Date(start) };
  const guard = new QuotaGuard(await testDb(), c, {
    now: () => clock.t,
    tz: "Europe/Budapest",
    dryRun,
  });
  return { guard, clock };
}

describe("QuotaGuard", () => {
  it("allows under the cap and refuses at it", async () => {
    const { guard } = await setup(caps(1, 10), "2026-10-30T10:00:00Z");
    expect((await guard.reserve("serpapi", "verify")).ok).toBe(true);
    const r = await guard.reserve("serpapi", "verify");
    expect(r).toMatchObject({ ok: false, kind: "quota_exhausted" });
  });

  it("rolls over the day", async () => {
    const { guard, clock } = await setup(caps(1, 10), "2026-10-30T10:00:00Z");
    await guard.reserve("serpapi", "verify");
    clock.t = new Date("2026-10-31T10:00:00Z");
    expect((await guard.reserve("serpapi", "verify")).ok).toBe(true);
  });

  it("rolls over the month at Budapest midnight (UTC+1 in winter)", async () => {
    const { guard, clock } = await setup(caps(10, 1), "2027-01-31T22:59:00Z"); // 23:59 CET
    expect((await guard.reserve("serpapi", "verify")).ok).toBe(true);
    expect((await guard.reserve("serpapi", "verify")).ok).toBe(false);
    clock.t = new Date("2027-01-31T23:00:00Z"); // 00:00 CET Feb 1
    expect((await guard.reserve("serpapi", "verify")).ok).toBe(true);
  });

  it("grants exactly the cap under concurrency", async () => {
    const { guard } = await setup(caps(3, 10), "2026-10-30T10:00:00Z");
    const rs = await Promise.all(
      Array.from({ length: 10 }, () => guard.reserve("serpapi", "verify")),
    );
    expect(rs.filter((r) => r.ok)).toHaveLength(3);
  });

  it("counts error-settled rows", async () => {
    const { guard } = await setup(caps(1, 10), "2026-10-30T10:00:00Z");
    const r = await guard.reserve("serpapi", "verify");
    if (!r.ok) throw new Error("expected ok");
    await guard.settle(r.id, "error");
    expect((await guard.reserve("serpapi", "verify")).ok).toBe(false);
    expect(await guard.remaining("serpapi")).toEqual({
      dayUsed: 1,
      dayCap: 1,
      monthUsed: 1,
      monthCap: 10,
    });
  });

  it("refuses everything in dry run except fixture", async () => {
    const { guard } = await setup(caps(5, 5), "2026-10-30T10:00:00Z", true);
    expect(await guard.reserve("serpapi", "verify")).toMatchObject({ ok: false, kind: "dry_run" });
    expect((await guard.reserve("fixture", "discover")).ok).toBe(true);
  });

  it("treats cap 0 as disabled", async () => {
    const { guard } = await setup(caps(0, 10), "2026-10-30T10:00:00Z");
    expect(await guard.reserve("serpapi", "verify")).toMatchObject({
      ok: false,
      kind: "quota_exhausted",
    });
  });

  it("never meters fixture", async () => {
    const { guard } = await setup(caps(1, 1), "2026-10-30T10:00:00Z");
    for (let i = 0; i < 3; i++) expect((await guard.reserve("fixture", "discover")).ok).toBe(true);
  });
});
