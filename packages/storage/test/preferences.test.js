import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createPreferenceStore } from "@bedrock-server-manager/storage/preferenceStore";

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
    assert.equal(store.read("alice", "layout", "list"), "grid");
    assert.equal(store.read("bob", "layout", "list"), "list");
  });
  it("falls back for invalid versions and malformed JSON", () => {
    const backend = storage();
    const store = createPreferenceStore(backend);
    const key = "bsm:alice:preference:layout";
    backend.setItem(key, JSON.stringify({ version: 99, value: "grid" }));
    assert.equal(store.read("alice", "layout", "list"), "list");
    backend.setItem(key, "invalid-json");
    assert.equal(store.read("alice", "layout", "list"), "list");
  });

  it("does not persist unauthenticated preferences", () => {
    const store = createPreferenceStore(storage());
    assert.equal(store.write(null, "layout", "grid"), false);
    assert.equal(store.read(null, "layout", "list"), "list");
  });

  it("rejects invalid preference values", () => {
    const store = createPreferenceStore(storage());
    store.write("alice", "layout", "grid");
    assert.equal(
      store.read("alice", "layout", "list", (value) => value === "list"),
      "list",
    );
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
  assert.equal(store.read("alice", "layout", "list"), "grid");
  assert.equal(
    JSON.parse(backend.getItem("bsm:alice:preference:layout")).version,
    2,
  );
  assert.equal(store.write("alice", "layout", "bad"), false);
});
it("notifies subscribers and releases them", () => {
  const store = createPreferenceStore(storage());
  let calls = 0;
  const stop = store.subscribe("alice", "layout", () => calls++);
  store.write("alice", "layout", "grid");
  store.remove("alice", "layout");
  stop();
  store.write("alice", "layout", "list");
  assert.equal(calls, 2);
});
it("synchronizes memory preferences when durable storage throws, including removal", () => {
  const store = createPreferenceStore({
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("full");
    },
    removeItem() {
      throw new Error("blocked");
    },
  });
  let notifications = 0;
  const stop = store.subscribe("alice", "layout", () => notifications++);
  assert.equal(store.write("alice", "layout", "grid"), true);
  assert.equal(store.read("alice", "layout", "list"), "grid");
  assert.equal(store.read("bob", "layout", "list"), "list");
  assert.equal(store.remove("alice", "layout"), true);
  assert.equal(store.read("alice", "layout", "list"), "list");
  assert.equal(notifications, 2);
  stop();
});
