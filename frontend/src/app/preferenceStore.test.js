import { describe, expect, it } from "vitest";
import { createPreferenceStore } from "./preferenceStore";

const storage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
};

describe("preference storage", () => {
  it("keeps accounts separate", () => {
    const store = createPreferenceStore(storage());
    store.write("alice", "layout", "grid");
    expect(store.read("alice", "layout", "list")).toBe("grid");
    expect(store.read("bob", "layout", "list")).toBe("list");
  });
  it("rejects invalid preference values", () => {
    const store = createPreferenceStore(storage());
    store.write("alice", "layout", "grid");
    expect(store.read("alice", "layout", "list", (value) => value === "list")).toBe("list");
  });
});
