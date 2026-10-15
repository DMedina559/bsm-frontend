import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import PanoramaSettings from "../../../../src/components/appearance/PanoramaSettings";
import { DEFAULT_APPEARANCE } from "../../../../src/utils/theme";

const state = vi.hoisted(() => ({
  appearance: {},
  updateAppearance: vi.fn(),
  reducedMotion: false,
}));
vi.mock("../../../../src/contexts/ThemeContext", () => ({
  useTheme: () => state,
}));

describe("panorama controls", () => {
  it("keeps motion preferences available when the panorama is disabled", () => {
    state.appearance = { ...DEFAULT_APPEARANCE };
    render(<PanoramaSettings />);
    expect(screen.getByLabelText("Image size")).toBeDisabled();
    expect(screen.getByLabelText("Reduced motion")).toBeEnabled();
    fireEvent.change(screen.getByLabelText("Reduced motion"), {
      target: { value: "reduce" },
    });
    expect(state.updateAppearance).toHaveBeenCalledWith({
      reducedMotion: "reduce",
    });
  });
  it("exposes custom scale and parallax strength without an automatic animation", () => {
    state.appearance = {
      ...DEFAULT_APPEARANCE,
      panorama: true,
      panoramaSize: "custom",
      panoramaAttachment: "parallax",
    };
    render(<PanoramaSettings />);
    fireEvent.change(screen.getByRole("slider", { name: /Image scale/ }), {
      target: { value: "175" },
    });
    expect(state.updateAppearance).toHaveBeenCalledWith({ panoramaScale: 175 });
    expect(
      screen.getByRole("slider", { name: /Parallax strength/ }),
    ).toBeEnabled();
    expect(
      screen.queryByLabelText("Automatic movement"),
    ).not.toBeInTheDocument();
  });
  it("offers movement direction and adjustable duration", () => {
    state.appearance = {
      ...DEFAULT_APPEARANCE,
      panorama: true,
      panoramaMotion: "horizontal",
    };
    render(<PanoramaSettings />);
    const movement = screen.getByLabelText("Automatic movement");
    expect(
      within(movement).getByRole("option", { name: "Diagonal drift" }),
    ).toBeInTheDocument();
    fireEvent.change(
      screen.getByRole("slider", { name: /Movement duration/ }),
      { target: { value: "120" } },
    );
    expect(state.updateAppearance).toHaveBeenCalledWith({
      panoramaDuration: 120,
    });
  });
});
