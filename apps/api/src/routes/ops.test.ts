import { describe, expect, it, vi } from "vitest";
import { runs } from "../db/schema.js";
import type { Notifier } from "../notify/index.js";
import { NOW } from "../providers/testkit.js";
import { testApp } from "../test/app.js";

describe("refresh", () => {
  it("runs, reports status, then rate limits", async () => {
    const { app } = await testApp();
    const first = await app.inject({ method: "POST", url: "/api/refresh" });
    expect(first.statusCode).toBe(200);
    expect(first.json()).toMatchObject({ status: "done", summary: { watches: 0 } });
    expect((await app.inject({ url: "/api/refresh/status" })).json()).toMatchObject({
      status: "done",
    });
    expect((await app.inject({ method: "POST", url: "/api/refresh" })).statusCode).toBe(429);
  });

  it("409 while a run is in progress", async () => {
    const { app, db } = await testApp();
    await db.insert(runs).values({ status: "running", startedAt: NOW.toISOString() });
    expect((await app.inject({ method: "POST", url: "/api/refresh" })).statusCode).toBe(409);
  });
});

describe("auth", () => {
  it("fails closed on Vercel production without API_TOKEN", async () => {
    const { app } = await testApp({ env: { VERCEL_ENV: "production" } });
    const payload = { destination: "LIS" };
    expect((await app.inject({ method: "GET", url: "/api/watches" })).statusCode).toBe(200);
    expect((await app.inject({ method: "POST", url: "/api/watches", payload })).statusCode).toBe(
      503,
    );
  });

  it("API_TOKEN guards mutating routes only", async () => {
    const { app } = await testApp({ env: { API_TOKEN: "tok" } });
    const payload = { destination: "LIS" };
    expect((await app.inject({ method: "GET", url: "/api/watches" })).statusCode).toBe(200);
    expect((await app.inject({ method: "POST", url: "/api/watches", payload })).statusCode).toBe(
      401,
    );
    const bad = { authorization: "Bearer nope" };
    expect(
      (await app.inject({ method: "POST", url: "/api/watches", payload, headers: bad })).statusCode,
    ).toBe(401);
    const good = { authorization: "Bearer tok" };
    expect(
      (await app.inject({ method: "POST", url: "/api/watches", payload, headers: good }))
        .statusCode,
    ).toBe(201);
  });
});

describe("cron", () => {
  const run = (app: Awaited<ReturnType<typeof testApp>>["app"], authorization?: string) =>
    app.inject({ url: "/api/cron/run", headers: authorization ? { authorization } : {} });

  it("503 when CRON_SECRET is unset", async () => {
    const { app } = await testApp();
    expect((await run(app, "Bearer x")).statusCode).toBe(503);
  });

  it("401 on a wrong or missing secret, 200 on the right one", async () => {
    const { app } = await testApp({ env: { CRON_SECRET: "s3" } });
    expect((await run(app)).statusCode).toBe(401);
    expect((await run(app, "Bearer wrong")).statusCode).toBe(401);
    const ok = await run(app, "Bearer s3");
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({ status: "done" });
  });

  it("ignores API_TOKEN for the cron route", async () => {
    const { app } = await testApp({ env: { CRON_SECRET: "s3", API_TOKEN: "tok" } });
    expect((await run(app, "Bearer s3")).statusCode).toBe(200);
  });
});

describe("notify test", () => {
  it("reports per-channel results", async () => {
    const ok: Notifier = { name: "good", send: vi.fn(async () => {}) };
    const bad: Notifier = {
      name: "bad",
      send: async () => {
        throw new Error("telegram HTTP 500");
      },
    };
    const { app } = await testApp({ notifiers: [ok, bad] });
    const r = await app.inject({ method: "POST", url: "/api/notify/test" });
    expect(r.json()).toEqual({
      channels: [
        { name: "good", ok: true },
        { name: "bad", ok: false, error: "telegram HTTP 500" },
      ],
    });
    expect(ok.send).toHaveBeenCalledOnce();
  });

  it("no channels configured", async () => {
    const { app } = await testApp();
    expect((await app.inject({ method: "POST", url: "/api/notify/test" })).json()).toEqual({
      channels: [],
    });
  });
});
