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
    expect(
      JSON.parse(localStorage.getItem("bsm:admin:preference:appearance")).value
        .panorama,
    ).toBe(true);
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
      JSON.parse(localStorage.getItem("bsm:admin:preference:appearance")).value
        .panoramaVisibility,
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

function ResetHarness() {
  const context = useTheme();
  return (
    <>
      <button
        onClick={() => {
          context.savePalette({
            name: "Custom",
            accent: "#159568",
            page: "#101a16",
            surface: "#192820",
            text: "#eaf5ee",
            muted: "#a7bdae",
          });
          context.updateAppearance({
            mode: "light",
            density: "compact",
            panorama: true,
            panoramaVisibility: 70,
            sidebarTransparency: 50,
          });
        }}
      >
        Customize
      </button>
      <button onClick={() => context.resetAppearance().catch(() => {})}>
        Reset
      </button>
    </>
  );
}
describe("appearance reset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    request.mockResolvedValue({ status: "success" });
    auth.checkUser.mockResolvedValue();
  });
  it("resets account theme, palette selection and every display preference", async () => {
    auth.user = { username: "admin", theme: "blue" };
    render(
      <ThemeProvider>
        <ResetHarness />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByText("Customize"));
    fireEvent.click(screen.getByText("Reset"));
    await waitFor(() =>
      expect(document.documentElement.dataset.theme).toBe("default"),
    );
    expect(request).toHaveBeenCalledWith("/api/account/theme", {
      method: "POST",
      body: { theme: "default" },
    });
    expect(
      JSON.parse(localStorage.getItem("bsm:admin:preference:appearance")).value,
    ).toEqual({
      mode: "theme",
      density: "comfortable",
      panorama: false,
      panoramaVisibility: 18,
      sidebarTransparency: 0,
    });
    const palettes = JSON.parse(
      localStorage.getItem("bsm:admin:preference:palettes"),
    ).value;
    expect(palettes.active).toBeNull();
    expect(palettes.palettes).toHaveLength(1);
    expect(document.getElementById("personal-palette").textContent).toBe("");
  });
  it("keeps existing preferences when resetting the account theme fails", async () => {
    auth.user = { username: "admin", theme: "blue" };
    request.mockRejectedValue(new Error("Offline"));
    render(
      <ThemeProvider>
        <ResetHarness />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByText("Customize"));
    fireEvent.click(screen.getByText("Reset"));
    await waitFor(() => expect(request).toHaveBeenCalled());
    expect(document.documentElement.dataset.theme).toBe("blue");
    expect(
      JSON.parse(localStorage.getItem("bsm:admin:preference:appearance")).value
        .panorama,
    ).toBe(true);
    expect(
      JSON.parse(localStorage.getItem("bsm:admin:preference:palettes")).value
        .active,
    ).toBe("Custom");
  });
});
