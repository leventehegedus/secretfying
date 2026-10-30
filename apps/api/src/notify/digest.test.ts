import { describe, expect, it } from "vitest";
import { buildDigest } from "./digest.js";
import type { DigestDeal, DigestInput } from "./digest.js";

const NOW = new Date("2026-10-30T10:00:00Z");
const deal = (o: Partial<DigestDeal> = {}): DigestDeal => ({
  origin: "BUD",
  destination: "LIS",
  departDate: "2026-12-05",
  returnDate: "2026-12-10",
  amount: 89,
  discountPct: 35.2,
  belowMaxPct: 10.5,
  source: "travelpayouts",
  observedAt: "2026-10-27T10:00:00Z",
  deepLink: "https://www.aviasales.com/search/X",
  status: "verified",
  ...o,
});
const input = (o: Partial<DigestInput> = {}): DigestInput => ({
  date: "2026-10-30",
  now: NOW,
  deals: [deal()],
  quota: { serpapi: { dayLeft: 12, monthLeft: 190 } },
  statuses: {},
  ...o,
});
const FOOTER = "Az árak gyorsan változnak, foglalás előtt ellenőrizd. Tájékoztató jellegű.";

describe("buildDigest", () => {
  it("renders every deal field in Hungarian", () => {
    const { subject, text } = buildDigest(input(), "hu");
    const lines = text.split("\n").map((l) => l.trim());
    expect(subject).toBe("Repjegy akciók – 2026-10-30");
    expect(lines).toContain("1. BUD → LIS");
    expect(lines).toContain("2026-12-05 – 2026-12-10 (oda-vissza)");
    expect(text).toContain(
      new Intl.NumberFormat("hu-HU", { style: "currency", currency: "EUR" }).format(89),
    );
    expect(text).toMatch(/35,2% a medián alatt/);
    expect(text).toMatch(/10,5% a maximum ár alatt/);
    expect(text).toContain("Forrás: travelpayouts, 3 napos adat");
    expect(lines).toContain("https://www.aviasales.com/search/X");
    expect(text).toContain("serpapi: 12 hívás maradt ma, 190 a hónapban");
    expect(text.split("\n").at(-1)).toBe(FOOTER);
  });

  it("says so when history is missing and never shows 0", () => {
    const { text } = buildDigest(
      input({ deals: [deal({ discountPct: null, belowMaxPct: null, returnDate: null })] }),
      "hu",
    );
    expect(text).toContain("nincs elég előzmény");
    expect(text).toContain("(egy út)");
    expect(text).not.toContain("maximum ár");
  });

  it("empty digest, unavailable sources and exhausted quotas are explicit", () => {
    const { text } = buildDigest(
      input({
        deals: [],
        quota: { serpapi: { dayLeft: 0, monthLeft: 100 } },
        statuses: { travelpayouts: "unavailable" },
      }),
      "hu",
    );
    expect(text).toContain("ma nincs akció");
    expect(text).toContain("Kimerült kvóta: serpapi");
    expect(text).toContain("Nem elérhető források: travelpayouts");
  });

  it("English variant", () => {
    expect(buildDigest(input({ deals: [] }), "en").text).toContain("no deals today");
  });

  it("stays under 4096 chars with 30 deals and long links", () => {
    const deals = Array.from({ length: 30 }, (_, i) =>
      deal({ deepLink: `https://x.example/${"a".repeat(600)}${i}` }),
    );
    const { text } = buildDigest(input({ deals }), "hu");
    expect(text.length).toBeLessThan(4096);
    expect(text).toMatch(/és még \d+ akció/);
    expect(text.split("\n").at(-1)).toBe(FOOTER);
  });

  it("caps at 10 deals with a count of the rest", () => {
    const { text } = buildDigest(input({ deals: Array.from({ length: 30 }, () => deal()) }), "hu");
    expect(text).toContain("10. BUD → LIS");
    expect(text).not.toContain("11. BUD");
    expect(text).toContain("és még 20 akció");
  });
});
