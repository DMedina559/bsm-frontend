import { render, screen } from "../test/utils";
import Footer from "./Footer";
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("../api");

describe("Footer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ needs_setup: false }),
    });
  });

  it("renders correctly", () => {
    render(<Footer />);
    expect(screen.getByText(/GitHub/)).toBeInTheDocument();
  });
});
