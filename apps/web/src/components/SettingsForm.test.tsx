import { DEFAULT_SETTINGS } from "@fdw/shared";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { hu } from "@/i18n/dict";
import { renderApp } from "@/test/utils";
import { SettingsForm } from "./SettingsForm";

const setup = () => {
  const onSubmit = vi.fn();
  renderApp(<SettingsForm initial={DEFAULT_SETTINGS} pending={false} onSubmit={onSubmit} />);
  return { onSubmit, user: userEvent.setup() };
};

describe("SettingsForm", () => {
  it("rejects an out-of-range percentage", async () => {
    const { onSubmit, user } = setup();
    const input = screen.getByLabelText(hu["settings.belowMedianPct"]);
    await user.clear(input);
    await user.type(input, "150");
    await user.click(screen.getByRole("button", { name: hu["common.save"] }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(hu["settings.error.range"])).toBeInTheDocument();
  });

  it("submits parsed settings and shows the default as a hint", async () => {
    const { onSubmit, user } = setup();
    expect(screen.getAllByText(hu["settings.default"].replace("{value}", "30"))).not.toHaveLength(
      0,
    );
    const input = screen.getByLabelText(hu["settings.verifyTopK"]);
    await user.clear(input);
    await user.type(input, "7");
    await user.click(screen.getByRole("button", { name: hu["common.save"] }));
    expect(onSubmit).toHaveBeenCalledWith({ ...DEFAULT_SETTINGS, verifyTopK: 7 });
  });
});
