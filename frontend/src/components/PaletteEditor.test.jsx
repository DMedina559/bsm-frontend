import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ThemeProvider } from "../ThemeContext";
import PaletteEditor from "./PaletteEditor";
import { PALETTE_KEY } from "../utils/palettes";
vi.mock("../AuthContext", () => ({
  useAuth: () => ({
    user: { username: "test", theme: "default" },
    checkUser: vi.fn(),
  }),
}));
vi.mock("../api", () => ({ request: vi.fn(), getApiBaseUrl: () => "" }));
describe("palette editor", () => {
  beforeEach(() => localStorage.clear());
  it("saves, applies, and removes a palette without an account theme request", async () => {
    render(
      <ThemeProvider>
        <PaletteEditor />
      </ThemeProvider>,
    );
    fireEvent.change(screen.getByLabelText("Palette name"), {
      target: { value: "Ocean custom" },
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
    expect(JSON.parse(localStorage.getItem(PALETTE_KEY)).active).toBe(
      "Ocean custom",
    );
    fireEvent.click(screen.getByText("Use account theme"));
    expect(document.getElementById("personal-palette").textContent).toBe("");
    fireEvent.click(screen.getByLabelText("Remove Ocean custom"));
    expect(JSON.parse(localStorage.getItem(PALETTE_KEY)).palettes).toEqual([]);
  });
  it("shows low-contrast feedback", () => {
    render(
      <ThemeProvider>
        <PaletteEditor />
      </ThemeProvider>,
    );
    fireEvent.change(screen.getByLabelText("Text"), {
      target: { value: "#192820" },
    });
    expect(screen.getByText(/below the recommended/)).toBeInTheDocument();
  });
});
