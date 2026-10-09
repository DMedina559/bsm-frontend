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
  it("falls back for invalid versions and malformed JSON", () => {
    const backend = storage();
    const store = createPreferenceStore(backend);
    const key = "bsm:alice:preference:layout";
    backend.setItem(key, JSON.stringify({ version: 99, value: "grid" }));
    expect(store.read("alice", "layout", "list")).toBe("list");
    backend.setItem(key, "invalid-json");
    expect(store.read("alice", "layout", "list")).toBe("list");
  });

  it("does not persist unauthenticated preferences", () => {
    const store = createPreferenceStore(storage());
    expect(store.write(null, "layout", "grid")).toBe(false);
    expect(store.read(null, "layout", "list")).toBe("list");
  });

  it("rejects invalid preference values", () => {
    const store = createPreferenceStore(storage());
    store.write("alice", "layout", "grid");
    expect(
      store.read("alice", "layout", "list", (value) => value === "list"),
    ).toBe("list");
  });
});

it("migrates and validates before persisting a new schema", () => {
  const backend = storage();
  backend.setItem(
    "bsm:alice:preference:layout",
    JSON.stringify({ version: 1, value: "cards" }),
  );
  const store = createPreferenceStore(backend, {
    layout: {
      version: 2,
      validate: (value) => value === "grid",
      migrations: { 1: (value) => (value === "cards" ? "grid" : value) },
    },
  });
  expect(store.read("alice", "layout", "list")).toBe("grid");
  expect(
    JSON.parse(backend.getItem("bsm:alice:preference:layout")).version,
  ).toBe(2);
  expect(store.write("alice", "layout", "bad")).toBe(false);
});
it("notifies subscribers and releases them", () => {
  const store = createPreferenceStore(storage());
  let calls = 0;
  const stop = store.subscribe("alice", "layout", () => calls++);
  store.write("alice", "layout", "grid");
  store.remove("alice", "layout");
  stop();
  store.write("alice", "layout", "list");
  expect(calls).toBe(2);
});
