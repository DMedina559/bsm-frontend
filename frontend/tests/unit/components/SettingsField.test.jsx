import React, { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { it, expect, vi } from "vitest";
import SettingsField from "../../../src/components/SettingsField";
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

it("uses bounds and units for metric intervals and protects reported server state", () => {
  render(
    <>
      <SettingsField
        path="monitoring.app_metrics_interval_sec"
        value={3}
        onChange={vi.fn()}
      />
      <SettingsField
        path="server_info.status"
        value="running"
        onChange={vi.fn()}
      />
    </>,
  );
  const interval = screen.getByLabelText("Application metrics interval");
  expect(interval).toHaveAttribute("type", "number");
  expect(interval).toHaveAttribute("min", "1");
  expect(interval).toHaveAttribute("max", "3600");
  expect(interval).toHaveAttribute("step", "1");
  expect(interval).toHaveAccessibleDescription(/seconds/);
  expect(screen.getByLabelText("status")).toHaveAttribute("readonly");
});

it("edits CORS origins without dropping separators and explains restart behavior", () => {
  function Harness() {
    const [origins, setOrigins] = useState(["https://one.example"]);
    return (
      <SettingsField
        path="web.cors_origins"
        value={origins}
        onChange={(_, value) => setOrigins(value)}
      />
    );
  }
  render(<Harness />);
  const input = screen.getByLabelText("Allowed CORS origins");
  expect(input).toHaveAccessibleDescription(/web server restart/);
  fireEvent.change(input, { target: { value: "https://one.example, " } });
  expect(input).toHaveValue("https://one.example, ");
  fireEvent.change(input, {
    target: { value: "https://one.example, https://two.example" },
  });
  expect(input).toHaveValue("https://one.example, https://two.example");
  fireEvent.change(input, { target: { value: "" } });
  expect(input).toHaveValue("");
});
