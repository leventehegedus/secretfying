import { describe, expect, it } from "vitest";
import { loadConfig } from "../config.js";
import { createFixtureProvider } from "./fixture.js";
import { buildRegistry } from "./registry.js";
import { jsonRes, NOW, testCtx } from "./testkit.js";

const log = { log: () => {} };
const ids = (ps: { id: string }[]) => ps.map((p) => p.id);

describe("buildRegistry", () => {
  it("disables providers without keys", () => {
    const r = buildRegistry(loadConfig({}), log);
    expect(r.discovery).toEqual([]);
    expect(r.verification).toEqual([]);
    expect(r.statuses).toEqual({
      travelpayouts: "disabled",
      serpapi: "disabled",
      fixture: "disabled",
    });
  });

  it("enables keyed providers in env order", () => {
    const r = buildRegistry(
      loadConfig({
        TRAVELPAYOUTS_TOKEN: "t",
        SERPAPI_KEY: "s",
        VERIFY_PROVIDERS: "serpapi,travelpayouts",
      }),
      log,
    );
    expect(ids(r.discovery)).toEqual(["travelpayouts"]);
    expect(ids(r.verification)).toEqual(["serpapi"]);
    expect(r.statuses).toMatchObject({ travelpayouts: "ok", serpapi: "ok" });
  });

  it("DRY_RUN uses only the fixture provider", () => {
    const r = buildRegistry(
      loadConfig({ DRY_RUN: "true", TRAVELPAYOUTS_TOKEN: "t", SERPAPI_KEY: "s" }),
      log,
    );
    expect(ids(r.discovery)).toEqual(["fixture"]);
    expect(ids(r.verification)).toEqual(["fixture"]);
    expect(r.statuses).toEqual({ travelpayouts: "dry_run", serpapi: "dry_run", fixture: "ok" });
  });

  it("never registers the fixture provider when DRY_RUN is off", () => {
    const r = buildRegistry(loadConfig({ DISCOVERY_PROVIDERS: "fixture" }), log);
    expect(r.discovery).toEqual([]);
  });
});

describe("fixture provider", () => {
  it("replays fixtures with the earliest departure 30 days after now", async () => {
    const { ctx } = await testCtx(async () => jsonRes({}));
    const p = createFixtureProvider();
    const r = await p.discover?.(
      {
        origin: "BUD",
        destination: "ANYWHERE",
        month: "2026-12",
        tripType: "return",
        currency: "EUR",
        market: "hu",
      },
      ctx,
    );
    expect(r?.ok).toBe(true);
    if (!r?.ok) return;
    const dates = r.observations.map((o) => o.departDate).sort();
    expect(dates[0]).toBe(new Date(NOW.getTime() + 30 * 86_400_000).toISOString().slice(0, 10));
    expect(r.observations.every((o) => o.source === "fixture" && o.returnDate !== null)).toBe(true);
    const v = await p.verify?.(
      {
        origin: "BUD",
        destination: "LIS",
        departDate: dates[0] ?? "",
        returnDate: null,
        currency: "EUR",
        maxStops: 1,
      },
      ctx,
    );
    expect(v).toMatchObject({ ok: true, observations: [{ source: "fixture", amount: 118 }] });
  });
});
