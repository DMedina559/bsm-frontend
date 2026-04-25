import { render, screen, act } from "../test/utils";
import Footer from "./Footer";
import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock global fetch to prevent unhandled rejections from providers
globalThis.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ needs_setup: false }),
  }),
);

describe("Footer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders correctly", async () => {
    await act(async () => {
      render(<Footer />);
    });
    expect(screen.getByText(/GitHub/)).toBeInTheDocument();
  });
});
