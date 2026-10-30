import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";

describe("loadConfig", () => {
  it("applies defaults", () => {
    const c = loadConfig({});
    expect(c.TURSO_DATABASE_URL).toBe("file:./data/fdw.db");
    expect(c.DRY_RUN).toBe(false);
    expect(c.QUOTA_SERPAPI_MONTHLY).toBe(200);
    expect(c.QUOTA_SERPAPI_DAILY).toBe(15);
    expect(c.DISCOVERY_PROVIDERS).toEqual(["travelpayouts"]);
    expect(c.VERIFY_PROVIDERS).toEqual(["serpapi"]);
    expect(c.TZ_SCHEDULE).toBe("Europe/Budapest");
    expect(c.PORT).toBe(3000);
  });

  it("parses booleans and provider lists", () => {
    const c = loadConfig({ DRY_RUN: "true", DISCOVERY_PROVIDERS: "fixture, travelpayouts" });
    expect(c.DRY_RUN).toBe(true);
    expect(c.DISCOVERY_PROVIDERS).toEqual(["fixture", "travelpayouts"]);
  });

  it("treats empty values as unset", () => {
    expect(loadConfig({ TURSO_AUTH_TOKEN: "", PORT: "" }).PORT).toBe(3000);
  });
  it("lists bad key names but never values", () => {
    const secret = "s3cret-value";
    let message = "";
    try {
      loadConfig({ DRY_RUN: secret, PORT: secret, VERIFY_PROVIDERS: "nope" });
    } catch (e) {
      message = e instanceof Error ? e.message : "";
    }
    expect(message).toContain("DRY_RUN");
    expect(message).toContain("PORT");
    expect(message).toContain("VERIFY_PROVIDERS");
    expect(message).not.toContain(secret);
    expect(message).not.toContain("nope");
  });
});
