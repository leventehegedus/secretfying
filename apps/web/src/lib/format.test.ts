import { describe, expect, it } from "vitest";
import { formatDate, formatMoney } from "./format";

describe("format", () => {
  it("formats EUR per language", () => {
    expect(formatMoney(129.5, "en")).toBe("€129.50");
    expect(formatMoney(129.5, "hu")).toContain("129,50");
  });

  it("returns null for missing values, never 0", () => {
    expect(formatMoney(null, "en")).toBeNull();
    expect(formatMoney(undefined, "hu")).toBeNull();
    expect(formatDate(null, "en")).toBeNull();
  });
});
