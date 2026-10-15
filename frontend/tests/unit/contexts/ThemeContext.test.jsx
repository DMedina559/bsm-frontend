import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../../../src/app/queryClient";
import { getPreferenceIdentity } from "../../../src/app/backendIdentity";
import { getSessionStorageKey } from "@bedrock-server-manager/storage";
import React from "react";
import {
  render as renderUI,
  act,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { ThemeProvider, useTheme } from "../../../src/contexts/ThemeContext";
import { DEFAULT_APPEARANCE } from "../../../src/utils/theme";
import { request } from "../../../src/api/transport";
vi.mock("../../../src/api/transport", () => ({
  request: vi.fn(),
  getApiBaseUrl: () => "",
  resolveApiUrl: (url) => url,
}));
const auth = vi.hoisted(() => ({
  user: { username: "admin", theme: "default" },
  checkUser: vi.fn(),
  updateAccount: vi.fn((patch) => {
    auth.user = { ...auth.user, ...patch };
  }),
}));
vi.mock("../../../src/contexts/AuthContext", () => ({ useAuth: () => auth }));
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
      <button
        onClick={() =>
          updateAppearance({
            panorama: true,
            panoramaSize: "custom",
            panoramaScale: 150,
            panoramaRepeat: "repeat-x",
            panoramaAttachment: "parallax",
            panoramaDuration: 90,
            panoramaMotion: "horizontal",
          })
        }
      >
        Customize
      </button>
      <button onClick={() => updateAppearance({ reducedMotion: "reduce" })}>
        Reduce motion
      </button>
      <button onClick={() => updateAppearance({ reducedMotion: "allow" })}>
        Allow motion
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
    expect(request).toHaveBeenCalledWith(
      "/api/account/theme",
      expect.objectContaining({
        method: "POST",
        body: { theme: "blue" },
      }),
    );
  });
  it("uses a later backend theme after a successful local save", async () => {
    const view = render(
      <ThemeProvider>
        <Harness />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByText("Change"));
    await waitFor(() =>
      expect(screen.getByTestId("theme")).toHaveTextContent("blue"),
    );
    auth.user = { ...auth.user, theme: "green" };
    view.rerender(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <Harness />
        </ThemeProvider>
      </QueryClientProvider>,
    );
    expect(screen.getByTestId("theme")).toHaveTextContent("green");
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
      JSON.parse(
        localStorage.getItem(
          getSessionStorageKey(
            getPreferenceIdentity({ username: "admin" }),
            "preference:appearance",
          ),
        ),
      ).value.panorama,
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
      JSON.parse(
        localStorage.getItem(
          getSessionStorageKey(
            getPreferenceIdentity({ username: "admin" }),
            "preference:appearance",
          ),
        ),
      ).value.panoramaVisibility,
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
    expect(request).toHaveBeenCalledWith(
      "/api/account/theme",
      expect.objectContaining({
        method: "POST",
        body: { theme: "default" },
      }),
    );
    expect(
      JSON.parse(
        localStorage.getItem(
          getSessionStorageKey(
            getPreferenceIdentity({ username: "admin" }),
            "preference:appearance",
          ),
        ),
      ).value,
    ).toEqual({
      ...DEFAULT_APPEARANCE,
      mode: "theme",
      density: "comfortable",
      panorama: false,
      panoramaVisibility: 18,
      sidebarTransparency: 0,
    });
    const palettes = JSON.parse(
      localStorage.getItem(
        getSessionStorageKey(
          getPreferenceIdentity({ username: "admin" }),
          "preference:palettes",
        ),
      ),
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
      JSON.parse(
        localStorage.getItem(
          getSessionStorageKey(
            getPreferenceIdentity({ username: "admin" }),
            "preference:appearance",
          ),
        ),
      ).value.panorama,
    ).toBe(true);
    expect(
      JSON.parse(
        localStorage.getItem(
          getSessionStorageKey(
            getPreferenceIdentity({ username: "admin" }),
            "preference:palettes",
          ),
        ),
      ).value.active,
    ).toBe("Custom");
  });
});

function render(element) {
  return renderUI(
    <QueryClientProvider client={queryClient}>{element}</QueryClientProvider>,
  );
}

it("applies customized backgrounds and disables movement for reduced motion", async () => {
  renderUI(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Harness />
      </ThemeProvider>
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByText("Customize"));
  const root = document.documentElement;
  expect(root.style.getPropertyValue("--bsm-panorama-size")).toBe("150% auto");
  expect(root.style.getPropertyValue("--bsm-panorama-repeat")).toBe("repeat-x");
  expect(root.style.getPropertyValue("--bsm-panorama-duration")).toBe("90s");
  expect(root.dataset.panoramaMotion).toBe("none");
  const scroller = document.createElement("div");
  scroller.className = "main-content";
  scroller.scrollTop = 300;
  document.body.append(scroller);
  fireEvent.scroll(scroller);
  await waitFor(() =>
    expect(root.style.getPropertyValue("--bsm-panorama-position")).toBe(
      "50% calc(50% + 60px)",
    ),
  );
  scroller.remove();
  fireEvent.click(screen.getByText("Reduce motion"));
  expect(root.dataset.reducedMotion).toBe("true");
  expect(root.style.getPropertyValue("--bsm-panorama-attachment")).toBe(
    "scroll",
  );
});

it("reacts to device reduced-motion changes and removes its listener on unmount", () => {
  const original = window.matchMedia;
  let motionListener;
  const remove = vi.fn();
  window.matchMedia = vi.fn((query) => ({
    matches: false,
    addEventListener: (_type, listener) => {
      if (query === "(prefers-reduced-motion: reduce)")
        motionListener = listener;
    },
    removeEventListener: remove,
  }));
  try {
    localStorage.clear();
    const view = renderUI(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <Harness />
        </ThemeProvider>
      </QueryClientProvider>,
    );
    act(() => motionListener({ matches: true }));
    expect(document.documentElement.dataset.reducedMotion).toBe("true");
    fireEvent.click(screen.getByText("Allow motion"));
    expect(document.documentElement.dataset.reducedMotion).toBe("false");
    act(() => motionListener({ matches: false }));
    expect(document.documentElement.dataset.reducedMotion).toBe("false");
    view.unmount();
    expect(remove).toHaveBeenCalledWith("change", motionListener);
    expect(document.documentElement.dataset.reducedMotion).toBeUndefined();
  } finally {
    window.matchMedia = original;
  }
});
