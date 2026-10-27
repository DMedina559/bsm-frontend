import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup } from "@testing-library/react";
import Timestamp from "../../../src/components/Timestamp";
import { TimeContext } from "../../../src/contexts/TimeContext";

afterEach(cleanup);
describe("Timestamp", () => {
  it("changes presentation without changing the stored instant", () => {
    const value = "2026-10-27T01:00:00Z";
    const view = (timezone) => (
      <TimeContext.Provider value={{ timezone }}>
        <Timestamp value={value} />
      </TimeContext.Provider>
    );
    const { rerender } = render(view("America/Los_Angeles"));
    const time = screen.getByTitle(/UTC: 2026-10-27T01:00:00.000Z/);
    expect(time).toHaveAttribute("datetime", "2026-10-27T01:00:00.000Z");
    expect(time).toHaveTextContent("Oct 26");
    expect(time).toHaveTextContent("PDT");
    rerender(view("UTC"));
    expect(time).toHaveTextContent("Oct 27");
    expect(time).toHaveAttribute("datetime", "2026-10-27T01:00:00.000Z");
  });
  it("honors a schedule's explicit timezone and handles missing instants", () => {
    const { rerender } = render(
      <Timestamp value="2026-07-15T21:00:00Z" timezone="America/Los_Angeles" />,
    );
    expect(screen.getByText(/2:00.*PM.*PDT/)).toBeInTheDocument();
    rerender(<Timestamp value={null} fallback="Not recorded" />);
    expect(screen.getByText("Not recorded")).toBeInTheDocument();
  });
});
