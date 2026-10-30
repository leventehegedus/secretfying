import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { hu } from "@/i18n/dict";
import type { Observation } from "@/lib/schemas";
import { renderApp } from "@/test/utils";
import { ObservationsTable } from "./ObservationsTable";

const base: Observation = {
  observedAt: "2026-10-02T06:00:00.000Z",
  amount: 80,
  departDate: "2026-12-01",
  returnDate: null,
  source: "travelpayouts",
  isCached: true,
};

describe("ObservationsTable", () => {
  it("labels demo, cached and live observations", () => {
    renderApp(
      <ObservationsTable
        rows={[
          { ...base, source: "fixture" },
          base,
          { ...base, source: "serpapi", isCached: false },
        ]}
      />,
    );
    expect(screen.getByText(hu["common.demo"])).toBeInTheDocument();
    expect(screen.getByText(hu["common.cached"])).toBeInTheDocument();
    expect(screen.getByText(hu["common.live"])).toBeInTheDocument();
  });
});
