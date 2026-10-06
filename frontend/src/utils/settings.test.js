import { describe, it, expect } from "vitest";
import { updateSetting, flattenSettings, isSafeSettingPath } from "./settings";
describe("settings utilities", () => {
  it("preserves numbers, zero, false, null, and arrays", () => {
    expect(
      flattenSettings({
        group: { zero: 0, flag: false, values: [1, 2], empty: null },
      }),
    ).toEqual({
      "group.zero": 0,
      "group.flag": false,
      "group.values": [1, 2],
      "group.empty": null,
    });
  });
  it("updates nested paths without mutating source", () => {
    const source = { group: { a: 1, b: 2 } };
    expect(updateSetting(source, "group.a", 3)).toEqual({
      group: { a: 3, b: 2 },
    });
    expect(source.group.a).toBe(1);
  });
  it("blocks reserved keys at any depth", () => {
    for (const path of [
      "__proto__.polluted",
      "group.constructor.value",
      "group.prototype",
      "group..key",
    ]) {
      expect(isSafeSettingPath(path)).toBe(false);
      expect(updateSetting({}, path, true)).toEqual({});
    }
    expect({}.polluted).toBeUndefined();
  });
});
