import { beforeEach, expect, it } from "vitest";
import {
  getPreferenceIdentity,
  migrateAccountPreference,
} from "./backendIdentity";
import { createPreferenceStore } from "./preferenceStore";
beforeEach(() => localStorage.clear());
it("isolates identical account IDs across backends and ingress paths", () => {
  const user = { id: 1 };
  localStorage.setItem("api_base_url", "https://bsm.example/one/");
  const one = getPreferenceIdentity(user);
  localStorage.setItem("api_base_url", "https://bsm.example/two");
  expect(getPreferenceIdentity(user)).not.toBe(one);
  localStorage.setItem("api_base_url", "https://bsm.example/one");
  expect(getPreferenceIdentity(user)).toBe(one);
});
it("migrates account-only preferences on the default backend without overwriting scoped values", () => {
  const store = createPreferenceStore();
  store.write("alice", "layout", "compact");
  migrateAccountPreference(store, { username: "alice" }, "layout");
  expect(
    store.read(getPreferenceIdentity({ username: "alice" }), "layout"),
  ).toBe("compact");
  expect(store.read("alice", "layout", null)).toBeNull();
  store.write("alice", "layout", "list");
  migrateAccountPreference(store, { username: "alice" }, "layout");
  expect(
    store.read(getPreferenceIdentity({ username: "alice" }), "layout"),
  ).toBe("compact");
});
