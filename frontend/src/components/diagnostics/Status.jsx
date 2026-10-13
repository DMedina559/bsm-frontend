import { labelFor } from "./format";

export default function Status({ value }) {
  return (
    <span
      className={`diagnostic-status diagnostic-status-${value ?? "unknown"}`}
    >
      {value === "ok" ? "Healthy" : labelFor(value ?? "unknown")}
    </span>
  );
}
