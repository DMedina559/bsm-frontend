import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import TimeProvider from "../../../src/contexts/TimeProvider";
import { useTimeFormat } from "../../../src/app/useTimeFormat";
const state = vi.hoisted(() => ({
  zone: "America/Los_Angeles",
  mode: "application",
}));
vi.mock("../../../src/app/resourceQueries", () => ({
  useResourceQuery: () => ({ data: { timezone: state.zone } }),
}));
vi.mock("../../../src/app/usePreference", () => ({
  usePreference: () => [state.mode],
}));
afterEach(cleanup);
function Reading() {
  const { timezone } = useTimeFormat();
  return <span>{timezone}</span>;
}
it("reacts to backend defaults and account display preferences without leaking a prior timezone", () => {
  const { rerender } = render(
    <TimeProvider>
      <Reading />
    </TimeProvider>,
  );
  expect(screen.getByText("America/Los_Angeles")).toBeInTheDocument();
  state.zone = "America/New_York";
  rerender(
    <TimeProvider>
      <Reading />
    </TimeProvider>,
  );
  expect(screen.getByText("America/New_York")).toBeInTheDocument();
  state.mode = "utc";
  rerender(
    <TimeProvider>
      <Reading />
    </TimeProvider>,
  );
  expect(screen.getByText("UTC")).toBeInTheDocument();
  state.mode = "application";
  state.zone = undefined;
  rerender(
    <TimeProvider>
      <Reading />
    </TimeProvider>,
  );
  expect(screen.getByText("UTC")).toBeInTheDocument();
});
