import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { ThemeProvider, useTheme } from "./ThemeContext";
import { request } from "./api";
vi.mock("./api", () => ({ request: vi.fn(), getApiBaseUrl: () => "" }));
const auth = vi.hoisted(() => ({
  user: { username: "admin", theme: "default" },
  checkUser: vi.fn(),
}));
vi.mock("./AuthContext", () => ({ useAuth: () => auth }));
function Harness() {
  const { theme, changeTheme, themeError, updateAppearance, appearance } =
    useTheme();
  return (
    <>
      <span data-testid="theme">{theme}</span>
      <span role="alert">{themeError}</span>
      <span data-testid="mode">{appearance.mode}</span>
      <button
        onClick={() => updateAppearance({ panorama: !appearance.panorama })}
      >
        Panorama
      </button>
      <button onClick={() => updateAppearance({ panoramaVisibility: 75 })}>
        Visibility
      </button>
      <button onClick={() => changeTheme("blue").catch(() => {})}>
        Change
      </button>
      <button
        onClick={() => updateAppearance({ mode: "light", density: "compact" })}
      >
        Display
      </button>
    </>
  );
}
describe("theme engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    auth.user = { username: "admin", theme: "default" };
    request.mockResolvedValue({ status: "success" });
    auth.checkUser.mockResolvedValue();
  });
  it("saves account themes exactly once", async () => {
    render(
      <ThemeProvider>
        <Harness />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByText("Change"));
    await waitFor(() =>
      expect(screen.getByTestId("theme")).toHaveTextContent("blue"),
    );
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith("/api/account/theme", {
      method: "POST",
      body: { theme: "blue" },
    });
  });
  it("preserves current theme on a failed save", async () => {
    request.mockRejectedValue(new Error("Save failed"));
    render(
      <ThemeProvider>
        <Harness />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByText("Change"));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Save failed"),
    );
    expect(screen.getByTestId("theme")).toHaveTextContent("default");
  });
  it("applies display settings without a backend request", async () => {
    render(
      <ThemeProvider>
        <Harness />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByText("Display"));
    await waitFor(() =>
      expect(document.documentElement.dataset.mode).toBe("light"),
    );
    expect(document.documentElement.dataset.density).toBe("compact");
    expect(request).not.toHaveBeenCalled();
  });
  it("keeps panoramas off by default and removes the image when disabled", async () => {
    const { unmount } = render(
      <ThemeProvider>
        <Harness />
      </ThemeProvider>,
    );
    expect(document.documentElement.dataset.panorama).toBe("false");
    expect(
      document.documentElement.style.getPropertyValue("--bsm-panorama-image"),
    ).toBe("");
    fireEvent.click(screen.getByText("Panorama"));
    await waitFor(() =>
      expect(document.documentElement.dataset.panorama).toBe("true"),
    );
    expect(
      document.documentElement.style.getPropertyValue("--bsm-panorama-image"),
    ).toContain("/api/panorama");
    expect(JSON.parse(localStorage.getItem("bsm.appearance.v4")).panorama).toBe(
      true,
    );
    expect(request).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Panorama"));
    expect(
      document.documentElement.style.getPropertyValue("--bsm-panorama-image"),
    ).toBe("");
    unmount();
    expect(document.documentElement.dataset.panorama).toBeUndefined();
  });
  it("updates and saves panorama visibility independently of its toggle", () => {
    render(
      <ThemeProvider>
        <Harness />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByText("Visibility"));
    expect(
      document.documentElement.style.getPropertyValue("--bsm-panorama-overlay"),
    ).toBe("25%");
    expect(
      JSON.parse(localStorage.getItem("bsm.appearance.v4")).panoramaVisibility,
    ).toBe(75);
    expect(document.documentElement.dataset.panorama).toBe("false");
  });
  it("surfaces stylesheet failures", async () => {
    render(
      <ThemeProvider>
        <Harness />
      </ThemeProvider>,
    );
    fireEvent.error(document.getElementById("theme-stylesheet"));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "could not be loaded",
      ),
    );
  });
});
