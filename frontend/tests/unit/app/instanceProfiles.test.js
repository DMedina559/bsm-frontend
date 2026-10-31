import { beforeEach, afterEach, expect, it, vi } from "vitest";
import {
  saveInstance,
  readInstances,
  selectInstance,
  getActiveInstance,
  readInstanceToken,
  writeInstanceToken,
  removeInstance,
  openInstanceTab,
  instanceCredentialKey,
  ACTIVE_INSTANCE_KEY,
  INSTANCE_RECORD_PREFIX,
  INSTANCE_PROFILES_KEY,
  renameInstance,
  updateInstance,
  getInstanceIssue,
  exportInstanceProfiles,
  importInstanceProfiles,
} from "../../../src/app/instanceProfiles";
import {
  getApiBaseUrl,
  getToken,
  isSessionStorageEvent,
  setCredentials,
  clearCredentials,
} from "../../../src/app/connection";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  sessionStorage.setItem("show_hidden_flag", "true");
});
afterEach(() => vi.restoreAllMocks());
it("keeps separate profiles and credentials for ingress paths on the same host", () => {
  const a = saveInstance({ name: "One", url: "https://bsm.test/ingress/a/" });
  const b = saveInstance({ name: "Two", url: "https://bsm.test/ingress/b" });
  writeInstanceToken(a.url, "token-a");
  writeInstanceToken(b.url, "token-b", true);
  selectInstance(a.id);
  expect(getApiBaseUrl()).toBe(a.url);
  expect(getToken()).toBe("token-a");
  selectInstance(b.id);
  expect(getToken()).toBe("token-b");
  expect(readInstanceToken(a.url)).toBe("token-a");
  expect(localStorage.getItem("api_base_url")).toBeNull();
  expect(isSessionStorageEvent({ key: instanceCredentialKey(a.url) })).toBe(
    false,
  );
  expect(JSON.stringify(readInstances())).not.toContain("token-");
});
it("rejects duplicate backends and credentials in profile URLs", () => {
  saveInstance({ name: "A", url: "https://bsm.test/" });
  expect(() => saveInstance({ name: "B", url: "https://bsm.test" })).toThrow(
    /already saved/,
  );
  expect(() =>
    saveInstance({ name: "B", url: "https://user:secret@bsm.test" }),
  ).toThrow();
});
it("hides profile selection when hidden mode is disabled", () => {
  const profile = saveInstance({ name: "One", url: "https://one.test" });
  selectInstance(profile.id);
  sessionStorage.removeItem("show_hidden_flag");
  expect(getActiveInstance()).toBeNull();
  expect(() => selectInstance(profile.id)).toThrow(/hidden/);
});
it("removing an instance forgets only its login and active selection", () => {
  const a = saveInstance({ name: "One", url: "https://one.test" });
  const b = saveInstance({ name: "Two", url: "https://two.test" });
  writeInstanceToken(a.url, "a");
  writeInstanceToken(b.url, "b");
  selectInstance(a.id);
  removeInstance(a.id);
  expect(getActiveInstance()).toBeNull();
  expect(readInstanceToken(a.url)).toBeNull();
  expect(readInstanceToken(b.url)).toBe("b");
  expect(readInstances()).toEqual([b]);
});
it("opens an independent tab with only the selected session token and no token in the URL", () => {
  const a = saveInstance({ name: "One", url: "https://one.test" });
  writeInstanceToken(a.url, "session-token");
  const data = new Map();
  const tab = {
    opener: {},
    sessionStorage: {
      clear: vi.fn(() => data.clear()),
      setItem: vi.fn((k, v) => data.set(k, v)),
    },
    location: { replace: vi.fn() },
    close: vi.fn(),
  };
  vi.spyOn(window, "open").mockReturnValue(tab);
  openInstanceTab(a.id);
  expect(tab.opener).toBeNull();
  expect(data.get(ACTIVE_INSTANCE_KEY)).toBe(a.id);
  expect(data.get(instanceCredentialKey(a.url))).toBe("session-token");
  expect(tab.location.replace.mock.calls[0][0]).not.toContain("session-token");
  expect(sessionStorage.getItem(ACTIVE_INSTANCE_KEY)).toBeNull();
});

it("preserves mixed-content profiles while editing another profile", () => {
  localStorage.setItem(
    INSTANCE_PROFILES_KEY,
    JSON.stringify([{ id: "http", name: "Local", url: "http://local.test" }]),
  );
  const other = saveInstance({ name: "Remote", url: "https://remote.test" });
  renameInstance(other.id, "Renamed");
  expect(readInstances().find((profile) => profile.id === "http")?.url).toBe(
    "http://local.test",
  );
  removeInstance("http");
  expect(readInstances()).toEqual([{ ...other, name: "Renamed" }]);
});
it("stores separate profile writes independently and observes external edits", () => {
  const one = saveInstance({ name: "One", url: "https://one.test" });
  const two = saveInstance({ name: "Two", url: "https://two.test" });
  localStorage.setItem(
    INSTANCE_RECORD_PREFIX + one.id,
    JSON.stringify({ ...one, name: "External" }),
  );
  renameInstance(two.id, "Second");
  expect(readInstances().map((profile) => profile.name)).toEqual([
    "External",
    "Second",
  ]);
});

it("broadcasts workspace credential changes to instance views without auth recursion", () => {
  const profile = saveInstance({ name: "One", url: "https://one.test" });
  selectInstance(profile.id);
  const listener = vi.fn();
  window.addEventListener("bsm:instance-credentials", listener);
  try {
    setCredentials("updated-token");
    expect(readInstanceToken(profile.url)).toBe("updated-token");
    expect(listener.mock.calls.at(-1)[0].detail).toEqual({
      url: profile.url,
      source: "workspace",
    });
    clearCredentials();
    expect(readInstanceToken(profile.url)).toBeNull();
  } finally {
    window.removeEventListener("bsm:instance-credentials", listener);
  }
});
it("reads saved HTTP profiles on an HTTPS page without deleting them on rename", () => {
  const profile = saveInstance({ name: "Local", url: "http://local.test" });
  const other = saveInstance({ name: "Remote", url: "https://remote.test" });
  vi.stubGlobal("window", {
    location: new URL("https://ui.test"),
    dispatchEvent: vi.fn(),
  });
  try {
    renameInstance(other.id, "Remote renamed");
    expect(readInstances()).toContainEqual(profile);
  } finally {
    vi.unstubAllGlobals();
  }
});

it("keeps removed selections disconnected from the default backend", () => {
  localStorage.setItem("api_base_url", "https://default.test");
  const profile = saveInstance({
    name: "Selected",
    url: "https://selected.test",
  });
  selectInstance(profile.id);
  removeInstance(profile.id);
  expect(getInstanceIssue()).toMatch(/removed/);
  expect(getApiBaseUrl()).toBe(profile.url);
  selectInstance(null);
  expect(getInstanceIssue()).toBeNull();
  expect(getApiBaseUrl()).toBe("https://default.test");
});
it("changes backend addresses without carrying credentials across targets", () => {
  const profile = saveInstance({ name: "One", url: "https://old.test" });
  writeInstanceToken(profile.url, "old-secret");
  writeInstanceToken("https://new.test", "previous-secret");
  selectInstance(profile.id);
  updateInstance(profile.id, {
    url: "https://new.test",
    group: "Home",
    color: "#abcdef",
    titleInTab: true,
  });
  expect(getApiBaseUrl()).toBe("https://new.test");
  expect(readInstanceToken(profile.url)).toBeNull();
  expect(readInstanceToken("https://new.test")).toBeNull();
  updateInstance(profile.id, { paused: true });
  expect(getInstanceIssue()).toMatch(/paused/);
  updateInstance(profile.id, { paused: false });
  expect(getInstanceIssue()).toBeNull();
});
it("exports and imports only whitelisted profile preferences, skipping duplicate URLs", () => {
  const profile = saveInstance({
    name: "Home",
    url: "https://home.test",
    group: "Home",
    color: "#abcdef",
    paused: true,
    titleInTab: true,
  });
  writeInstanceToken(profile.url, "secret-token");
  const exported = exportInstanceProfiles();
  expect(exported).not.toContain("secret-token");
  expect(exported).not.toContain(profile.id);
  const data = JSON.parse(exported);
  data.instances.push({
    name: "Remote",
    url: "https://remote.test",
    token: "evil-token",
    password: "secret-password",
    id: "injected",
  });
  expect(importInstanceProfiles(JSON.stringify(data))).toEqual({
    added: 1,
    skipped: 1,
  });
  expect(readInstances()[1].id).not.toBe("injected");
  expect(readInstanceToken("https://remote.test")).toBeNull();
  expect(exportInstanceProfiles()).not.toContain("secret-password");
  const before = readInstances();
  expect(() =>
    importInstanceProfiles(
      JSON.stringify({
        version: 1,
        instances: [
          { name: "Valid", url: "https://valid.test" },
          { name: "Invalid", url: "javascript:alert(1)" },
        ],
      }),
    ),
  ).toThrow();
  expect(readInstances()).toEqual(before);
});
