import { describe, expect, it } from "vitest";
import { cn } from "@/lib/cn";

describe("tooling", () => {
  it("resolves the @ alias", () => {
    expect(cn("a", false, "b")).toBe("a b");
  });
});
