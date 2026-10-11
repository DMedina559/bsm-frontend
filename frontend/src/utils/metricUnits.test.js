import { expect, it } from "vitest";
import { formatByteValue, byteScale, validMetricUnits } from "./metricUnits";
it("converts binary backend readings to decimal or binary display units", () => {
  expect(formatByteValue(1024 ** 3, "GiB", 2)).toBe("1.00 GiB");
  expect(formatByteValue(1024 ** 3, "GB", 3)).toBe("1.074 GB");
  expect(formatByteValue(1024 ** 2, "KB", 0, true)).toBe("1049 KB/s");
  expect(formatByteValue(1e12, "TB", 1)).toBe("1.0 TB");
});
it("automatically scales, preserving zero and unavailable readings", () => {
  expect(formatByteValue(1024 ** 3)).toBe("1.0 GiB");
  expect(formatByteValue(0)).toBe("0.0 B");
  expect(formatByteValue(null)).toBe("—");
  expect(formatByteValue(Infinity)).toBe("—");
  expect(byteScale(1024 ** 4, "auto").unit).toBe("TiB");
});
it("rejects invalid persisted preferences", () => {
  expect(
    validMetricUnits({
      memory: "GB",
      rate: "MiB",
      precision: 2,
      duration: "ms",
    }),
  ).toBe(true);
  expect(
    validMetricUnits({
      memory: "wrong",
      rate: "auto",
      precision: 1,
      duration: "ms",
    }),
  ).toBe(false);
  expect(
    validMetricUnits({
      memory: "auto",
      rate: "auto",
      precision: 10,
      duration: "s",
    }),
  ).toBe(false);
});
