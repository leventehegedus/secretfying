import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { hu } from "@/i18n/dict";
import { renderApp } from "@/test/utils";
import { WatchForm } from "./WatchForm";

const setup = () => {
  const onSubmit = vi.fn();
  renderApp(<WatchForm pending={false} issues={[]} onSubmit={onSubmit} onCancel={vi.fn()} />);
  return { onSubmit, user: userEvent.setup() };
};

describe("WatchForm", () => {
  it("rejects a minimum stay longer than the maximum stay", async () => {
    const { onSubmit, user } = setup();
    await user.type(screen.getByLabelText(hu["watch.destination"]), "LIS");
    await user.type(screen.getByLabelText(hu["watch.minStay"]), "10");
    await user.type(screen.getByLabelText(hu["watch.maxStay"]), "5");
    await user.click(screen.getByRole("button", { name: hu["common.save"] }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(hu["watch.error.stay"])).toBeInTheDocument();
  });

  it("submits a valid watch with defaults", async () => {
    const { onSubmit, user } = setup();
    await user.type(screen.getByLabelText(hu["watch.destination"]), "lis");
    await user.click(screen.getByRole("button", { name: hu["common.save"] }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ origin: "BUD", destination: "LIS", maxPrice: null, active: true }),
    );
  });

  it("shows server issues under their field", () => {
    renderApp(
      <WatchForm
        pending={false}
        issues={[{ path: "destination", message: "unknown IATA code" }]}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText("unknown IATA code")).toBeInTheDocument();
  });
});
