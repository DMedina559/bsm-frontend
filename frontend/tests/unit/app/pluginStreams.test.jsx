import React from "react";
import { act, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import {
  ChartWrapper,
  LogViewerWrapper,
  StatCardWrapper,
} from "../../../src/features/plugins/StreamComponents";
const transport = vi.hoisted(() => ({
  listeners: new Set(),
  addMessageListener: vi.fn((listener) => {
    transport.listeners.add(listener);
    return () => transport.listeners.delete(listener);
  }),
}));
vi.mock("../../../src/contexts/WebSocketContext", () => ({
  useWebSocket: () => transport,
}));
vi.mock("../../../src/features/plugins/componentRegistry", () => ({
  ComponentRegistry: {
    LogViewer: ({ lines }) => <pre data-testid="lines">{lines.join("\n")}</pre>,
    Chart: ({ data }) => <pre data-testid="chart">{JSON.stringify(data)}</pre>,
    StatCard: ({ value }) => <span data-testid="stat">{value}</span>,
  },
}));
const send = (topic, data) => {
  for (const listener of transport.listeners) listener({ topic, data });
};
it("retains every log and chart frame in a burst, bounds history, and releases old topics", () => {
  const view = render(
    <>
      <LogViewerWrapper socketTopic="alpha" />
      <ChartWrapper socketTopic="metrics" maxPoints={3} />
    </>,
  );
  act(() => {
    for (let i = 0; i < 5; i++) {
      send("alpha", `line-${i}\n`);
      send("metrics", { value: i });
    }
  });
  expect(screen.getByTestId("lines").textContent).toBe(
    "line-0\nline-1\nline-2\nline-3\nline-4",
  );
  expect(JSON.parse(screen.getByTestId("chart").textContent)).toEqual([
    { value: 2 },
    { value: 3 },
    { value: 4 },
  ]);
  view.rerender(<LogViewerWrapper key="beta" socketTopic="beta" />);
  act(() => {
    send("alpha", "private old line");
    send("beta", "current");
  });
  expect(screen.getByTestId("lines")).toHaveTextContent("current");
  expect(screen.getByTestId("lines")).not.toHaveTextContent("private");
  view.unmount();
  expect(transport.listeners.size).toBe(0);
});
it("refreshes stat initial values and accepts zero-valued updates", () => {
  const view = render(
    <StatCardWrapper socketTopic="stats" dataKey="players.count" value={5} />,
  );
  act(() => send("stats", { players: { count: 0 } }));
  expect(screen.getByTestId("stat")).toHaveTextContent("0");
  view.rerender(
    <StatCardWrapper socketTopic="stats" dataKey="players.count" value={9} />,
  );
  expect(screen.getByTestId("stat")).toHaveTextContent("9");
});
