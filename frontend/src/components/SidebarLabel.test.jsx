import { render, screen, act } from "../test/utils";
import SidebarLabel from "./SidebarLabel";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock global fetch to prevent unhandled rejections from providers
globalThis.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  }),
);

describe("SidebarLabel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders children text", async () => {
    await act(async () => {
      render(<SidebarLabel>Admin Settings</SidebarLabel>);
    });
    expect(screen.getByText("Admin Settings")).toBeInTheDocument();
  });

  it("handles resize event without throwing", async () => {
    await act(async () => {
      render(<SidebarLabel>Admin Settings</SidebarLabel>);
    });
    await act(async () => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(screen.getByText("Admin Settings")).toBeInTheDocument();
  });
});
