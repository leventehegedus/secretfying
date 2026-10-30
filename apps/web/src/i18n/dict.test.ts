import { describe, expect, it } from "vitest";
import { en, hu, translate } from "./dict";

describe("dictionary", () => {
  it("has identical keys in hu and en", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(hu).sort());
  });

  it("has no empty values", () => {
    for (const d of [hu, en]) expect(Object.values(d).every((v) => v.trim() !== "")).toBe(true);
  });

  it("interpolates params", () => {
    expect(translate("en", "dashboard.dealCount", { n: 3 })).toContain("3");
  });
});
