import test from "node:test";
import assert from "node:assert/strict";
import { createPreferenceStore } from "@bedrock-server-manager/storage/preferenceStore";

test("storage falls back to instance-local memory without browser persistence", () => {
  const one = createPreferenceStore(),
    two = createPreferenceStore();
  assert.equal(one.write("account", "density", "compact"), true);
  assert.equal(one.read("account", "density", "comfort"), "compact");
  assert.equal(two.read("account", "density", "comfort"), "comfort");
});

test("storage subscribes and releases injected persistence events", () => {
  const records = new Map();
  let callback;
  let removed = false;
  const storage = {
    getItem: (key) => records.get(key),
    setItem: (key, value) => records.set(key, value),
  };
  const events = {
    addEventListener: (_type, listener) => {
      callback = listener;
    },
    removeEventListener: (_type, listener) => {
      removed = listener === callback;
    },
  };
  const store = createPreferenceStore(storage, {}, events);
  let notified = 0;
  const stop = store.subscribe("one", "density", () => notified++);
  store.write("one", "density", "compact");
  callback({ key: null });
  assert.equal(notified, 2);
  stop();
  assert.equal(removed, true);
});

test("a failing subscriber does not interrupt persistence or other observers", () => {
  const store = createPreferenceStore();
  let calls = 0;
  store.subscribe("account", "density", () => {
    throw Error("subscriber failed");
  });
  store.subscribe("account", "density", () => calls++);
  assert.equal(store.write("account", "density", "compact"), true);
  assert.equal(store.read("account", "density", "comfort"), "compact");
  assert.equal(store.remove("account", "density"), true);
  assert.equal(calls, 2);
});
