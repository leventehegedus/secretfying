import { describe, expect, it } from "vitest";
import { buildApp } from "./app.js";

describe("GET /api/health", () => {
  it("returns ok", async () => {
    const res = await buildApp().inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });
});
