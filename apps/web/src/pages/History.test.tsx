import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { hu } from "@/i18n/dict";
import { renderApp } from "@/test/utils";
import { History } from "./History";

afterEach(() => vi.unstubAllGlobals());

describe("History", () => {
  it("sends the status and date filters to the API", async () => {
    const f = vi.fn((_url: string) => Promise.resolve(new Response("[]")));
    vi.stubGlobal("fetch", f);
    renderApp(<History />);
    await screen.findByText(hu["deals.empty"]);
    await userEvent.selectOptions(screen.getByLabelText(hu["history.status"]), "verified");
    await userEvent.type(screen.getByLabelText(hu["history.from"]), "2026-10-01");
    await screen.findByText(hu["deals.empty"]);
    const last = f.mock.calls.at(-1)?.[0] ?? "";
    expect(last).toContain("status=verified");
    expect(last).toContain("from=2026-10-01");
  });
});
