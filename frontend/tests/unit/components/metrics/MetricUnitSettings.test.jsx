import { render, screen, fireEvent, act } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import MetricUnitSettings from "../../../../src/components/metrics/MetricUnitSettings";
import { useMetricFormat } from "../../../../src/app/useMetricFormat";
vi.mock("../../../../src/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { username: "units-test" } }),
}));
function Reading() {
  const format = useMetricFormat();
  return <output aria-label="Memory reading">{format.memory(1024)}</output>;
}
it("applies saved units immediately, synchronizes another tab, and resets", () => {
  render(
    <>
      <MetricUnitSettings />
      <Reading />
    </>,
  );
  fireEvent.change(screen.getByLabelText("Memory and storage units"), {
    target: { value: "GB" },
  });
  fireEvent.change(screen.getByLabelText("Decimal places"), {
    target: { value: "3" },
  });
  expect(screen.getByLabelText("Memory reading")).toHaveTextContent("1.074 GB");
  const key = Array.from({ length: localStorage.length }, (_, index) =>
    localStorage.key(index),
  ).find((key) => key.includes("metricUnits"));
  const saved = JSON.parse(localStorage.getItem(key));
  expect(saved.value.memory).toBe("GB");
  const newValue = JSON.stringify({
    ...saved,
    value: { ...saved.value, memory: "MiB" },
  });
  act(() => {
    localStorage.setItem(key, newValue);
    window.dispatchEvent(new StorageEvent("storage", { key, newValue }));
  });
  expect(screen.getByLabelText("Memory reading")).toHaveTextContent(
    "1024.000 MiB",
  );
  fireEvent.click(screen.getByRole("button", { name: "Reset metric display" }));
  expect(screen.getByLabelText("Memory reading")).toHaveTextContent("1.0 GiB");
});
