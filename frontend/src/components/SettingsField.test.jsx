import React, { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { it, expect, vi } from "vitest";
import SettingsField from "./SettingsField";
it("displays zero and false without turning them into empty fields", () => {
  render(
    <>
      <SettingsField path="port" value={0} onChange={vi.fn()} />
      <SettingsField path="enabled" value={false} onChange={vi.fn()} />
    </>,
  );
  expect(screen.getByLabelText("port")).toHaveValue(0);
  expect(screen.getByLabelText("enabled")).toHaveValue("false");
});
it("retains numeric validation after clearing a number", () => {
  function Harness() {
    const [value, setValue] = useState(20);
    return (
      <SettingsField
        path="players"
        value={value}
        onChange={(_, next) => setValue(next)}
      />
    );
  }
  render(<Harness />);
  const input = screen.getByLabelText("players");
  fireEvent.change(input, { target: { value: "" } });
  expect(input).toHaveAttribute("type", "number");
  expect(input).toBeRequired();
  fireEvent.change(input, { target: { value: "25" } });
  expect(input).toHaveValue(25);
});
it("keeps server-reported fields read only", () => {
  render(
    <SettingsField path="status" value="running" readOnly onChange={vi.fn()} />,
  );
  expect(screen.getByLabelText("status")).toHaveAttribute("readonly");
});
