import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
const source = readFileSync(
  new URL("../../src/app/browserRecords.js", import.meta.url),
  "utf8",
);
test("IndexedDB records enforce scope, expiry, schema and capacity with safe failure", async ({
  page,
}) => {
  await page.goto("login");
  const result = await page.evaluate(async (source) => {
    let clock = Date.now();
    const url = URL.createObjectURL(
      new Blob([source], { type: "text/javascript" }),
    );
    // Existing version-one records survive the index-only database migration.
    await new Promise((resolve, reject) => {
      const request = indexedDB.open("bsm-view-state", 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore("records", { keyPath: "id" });
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("records", "readwrite");
        tx.objectStore("records").put({
          id: JSON.stringify(["backend/account", "draft", "legacy"]),
          scope: "backend/account",
          kind: "draft",
          version: 1,
          savedAt: clock,
          expiresAt: clock + 100,
          value: { legacy: true },
        });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
      };
    });
    const { createBrowserRecords } = await import(url);
    URL.revokeObjectURL(url);
    const records = createBrowserRecords({ indexedDB, now: () => clock });
    const migrated = await records.read("backend/account", "draft", "legacy");
    await records.write(
      "backend/account",
      "draft",
      "settings",
      { safe: true },
      100,
    );
    const own = await records.read("backend/account", "draft", "settings");
    const other = await records.read("backend/other", "draft", "settings");
    const otherBackend = await records.read(
      "other-backend/account",
      "draft",
      "settings",
    );
    clock += 101;
    const expired = await records.read("backend/account", "draft", "settings");
    for (let i = 0; i < 105; i++) {
      clock++;
      await records.write(
        "backend/account",
        "offline",
        `fleet-${i}`,
        { index: i },
        10000,
      );
    }
    const db = await new Promise((resolve) => {
      const request = indexedDB.open("bsm-view-state", 2);
      request.onsuccess = () => resolve(request.result);
    });
    const count = await new Promise((resolve) => {
      const request = db.transaction("records").objectStore("records").count();
      request.onsuccess = () => resolve(request.result);
    });
    await new Promise((resolve) => {
      const tx = db.transaction("records", "readwrite");
      tx.objectStore("records").put({
        id: JSON.stringify(["backend/account", "offline", "future-schema"]),
        version: 2,
        value: "unsupported",
        savedAt: clock,
        expiresAt: clock + 1000,
      });
      tx.oncomplete = resolve;
    });
    const unsupported = await records.read(
      "backend/account",
      "offline",
      "future-schema",
    );
    db.close();
    await records.clear("backend/account", "offline");
    const cleared = await records.read(
      "backend/account",
      "offline",
      "fleet-104",
    );
    const denied = createBrowserRecords({
      indexedDB: {
        open() {
          throw new DOMException("Disabled", "SecurityError");
        },
      },
    });
    const unavailable = await denied.write(
      "backend/account",
      "draft",
      "settings",
      {},
      100,
    );
    return {
      migrated: migrated.value,
      own: own.value,
      other: !!other,
      otherBackend: !!otherBackend,
      expired: !!expired,
      count,
      unsupported: !!unsupported,
      cleared: !!cleared,
      unavailable: !!unavailable,
    };
  }, source);
  expect(result).toEqual({
    migrated: { legacy: true },
    own: { safe: true },
    other: false,
    otherBackend: false,
    expired: false,
    count: 100,
    unsupported: false,
    cleared: false,
    unavailable: false,
  });
});
