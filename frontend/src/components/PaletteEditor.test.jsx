import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../app/queryClient";
import { getPreferenceIdentity } from "../app/backendIdentity";
import { getSessionStorageKey } from "../app/sessionBoundary";
import React from "react";
import {
  render as renderUI,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ThemeProvider } from "../contexts/ThemeContext";
import PaletteEditor from "./PaletteEditor";
const PALETTE_KEY = getSessionStorageKey(
  getPreferenceIdentity({ username: "test" }),
  "preference:palettes",
);
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { username: "test", theme: "default" },
    checkUser: vi.fn(),
  }),
}));
vi.mock("../api/transport", () => ({
  request: vi.fn(),
  getApiBaseUrl: () => "",
}));
describe("palette editor", () => {
  beforeEach(() => localStorage.clear());
  it("saves, applies, and removes a palette without an account theme request", async () => {
    render(
      <ThemeProvider>
        <PaletteEditor />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByText("Create palette"));
    fireEvent.change(screen.getByLabelText("Palette name"), {
      target: { value: "Ocean custom" },
    });
    fireEvent.change(screen.getByLabelText("Description (optional)"), {
      target: { value: "Blue evening tones" },
    });
    fireEvent.change(screen.getByLabelText("Accent"), {
      target: { value: "#2266bb" },
    });
    fireEvent.click(screen.getByText("Save and apply palette"));
    await waitFor(() =>
      expect(document.getElementById("personal-palette").textContent).toContain(
        "#2266bb",
      ),
    );
    expect(JSON.parse(localStorage.getItem(PALETTE_KEY)).value.active).toBe(
      "Ocean custom",
    );
    expect(
      screen.getByText("Selected · Blue evening tones"),
    ).toBeInTheDocument();
    expect(
      JSON.parse(localStorage.getItem(PALETTE_KEY)).value.palettes[0]
        .description,
    ).toBe("Blue evening tones");
    fireEvent.click(screen.getByText("Use account theme"));
    expect(document.getElementById("personal-palette").textContent).toBe("");
    fireEvent.click(screen.getByLabelText("Remove Ocean custom"));
    expect(
      JSON.parse(localStorage.getItem(PALETTE_KEY)).value.palettes,
    ).toEqual([]);
  });
  it("shows low-contrast feedback", () => {
    render(
      <ThemeProvider>
        <PaletteEditor />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByText("Create palette"));
    fireEvent.change(screen.getByLabelText("Text"), {
      target: { value: "#192820" },
    });
    expect(screen.getByText(/below the recommended/)).toBeInTheDocument();
  });
});

function render(element) {
  return renderUI(
    <QueryClientProvider client={queryClient}>{element}</QueryClientProvider>,
  );
}
