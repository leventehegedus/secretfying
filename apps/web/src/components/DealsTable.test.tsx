import type { Deal } from "@fdw/shared";
import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { hu } from "@/i18n/dict";
import { renderApp } from "@/test/utils";
import { DealsTable } from "./DealsTable";

const deal: Deal = {
  id: 1,
  watchId: 1,
  origin: "BUD",
  destination: "LIS",
  tripType: "return",
  departDate: "2026-12-01",
  returnDate: null,
  amount: 49,
  source: "travelpayouts",
  status: "candidate",
  reasons: ["BELOW_MAX_PRICE"],
  discountPct: null,
  belowMaxPct: null,
  detectedAt: "2026-10-30T06:00:00.000Z",
  verifiedAt: null,
};

describe("DealsTable", () => {
  it("shows missing fields as missing, never 0", () => {
    renderApp(<DealsTable deals={[deal]} />);
    const row = screen.getAllByRole("row")[1];
    if (!row) throw new Error("no row");
    const cells = within(row);
    expect(cells.getAllByText(hu["common.noData"]).length).toBeGreaterThanOrEqual(2);
    expect(row.textContent).not.toMatch(/\b0\s?%/);
    expect(cells.getByText(hu["common.cached"])).toBeInTheDocument();
  });

  it("labels fixture rows as demo and verified rows as live", () => {
    renderApp(
      <DealsTable
        deals={[
          { ...deal, source: "fixture" },
          { ...deal, id: 2, status: "verified", verifiedAt: deal.detectedAt },
        ]}
      />,
    );
    expect(screen.getByText(hu["common.demo"])).toBeInTheDocument();
    expect(screen.getByText(hu["common.live"])).toBeInTheDocument();
  });

  it("shows an empty message without rows", () => {
    renderApp(<DealsTable deals={[]} />);
    expect(screen.getByText(hu["deals.empty"])).toBeInTheDocument();
  });
});
