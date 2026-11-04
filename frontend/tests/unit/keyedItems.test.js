import { expect, it } from "vitest";
import { keyedItems } from "../../src/utils/keyedItems";

it("preserves row identity when distinct snapshot values move", () => {
  const first = { name: "first", status: "running" };
  const second = { name: "second", status: "stopped" };
  const before = keyedItems([first, second]);
  const after = keyedItems([second, { status: "running", name: "first" }]);
  expect(after.map(({ key }) => key)).toEqual([before[1].key, before[0].key]);
});

it("distinguishes duplicates without shifting unrelated row keys", () => {
  const before = keyedItems(["same", "other", "same"]);
  const after = keyedItems(["other", "same", "same"]);
  expect(new Set(before.map(({ key }) => key)).size).toBe(3);
  expect(after.map(({ key }) => key)).toEqual([
    before[1].key,
    before[0].key,
    before[2].key,
  ]);
});

it("uses a task identity across changing progress snapshots", () => {
  expect(keyedItems([{ id: "task", progress: 1 }])[0].key).toBe(
    keyedItems([{ id: "task", progress: 99 }])[0].key,
  );
});
