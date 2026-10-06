import React, { useState } from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { it, expect } from "vitest";
import { useRequestTracker } from "./useRequestTracker";
function Harness({ resource, load }) {
  const [value, setValue] = useState("No result");
  const begin = useRequestTracker(resource);
  return (
    <>
      <span>{value}</span>
      <button
        onClick={async () => {
          const ticket = begin("page");
          const result = await load();
          if (ticket.current()) setValue(result);
        }}
      >
        Load
      </button>
    </>
  );
}
it("ignores an old server response after switching workspaces", async () => {
  let finish;
  const load = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  const { rerender } = render(<Harness resource="first" load={load} />);
  fireEvent.click(screen.getByText("Load"));
  rerender(<Harness resource="second" load={async () => "Second server"} />);
  await act(async () => finish("First server"));
  expect(screen.getByText("No result")).toBeInTheDocument();
  await act(async () => fireEvent.click(screen.getByText("Load")));
  expect(screen.getByText("Second server")).toBeInTheDocument();
});
it("keeps the newer response when requests complete out of order", async () => {
  const finish = [];
  render(
    <Harness
      resource="same"
      load={() => new Promise((resolve) => finish.push(resolve))}
    />,
  );
  fireEvent.click(screen.getByText("Load"));
  fireEvent.click(screen.getByText("Load"));
  await act(async () => finish[1]("New response"));
  await act(async () => finish[0]("Old response"));
  expect(screen.getByText("New response")).toBeInTheDocument();
});
