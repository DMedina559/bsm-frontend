const DB_NAME = "bsm-view-state";
const MAX_RECORDS = 100;
const MAX_BYTES = 256_000;
/** Disposable browser records; failures never block the application. */
export function createBrowserRecords({ indexedDB, now = Date.now } = {}) {
  let database;
  let queue = Promise.resolve();
  const open = () => {
    if (!indexedDB) return Promise.resolve(null);
    if (!database)
      database = new Promise((resolve) => {
        const request = indexedDB.open(DB_NAME, 2);
        let settled = false;
        const unavailable = () => {
          settled = true;
          resolve(null);
        };
        const timer = setTimeout(unavailable, 3000);
        request.onupgradeneeded = () => {
          const db = request.result;
          const records = db.objectStoreNames.contains("records")
            ? request.transaction.objectStore("records")
            : db.createObjectStore("records", { keyPath: "id" });
          for (const key of ["savedAt", "expiresAt"])
            if (!records.indexNames.contains(key))
              records.createIndex(key, key);
        };
        request.onsuccess = () => {
          clearTimeout(timer);
          const db = request.result;
          if (settled) {
            db.close();
            return;
          }
          settled = true;
          db.onversionchange = () => {
            db.close();
            database = undefined;
          };
          resolve(db);
        };
        request.onerror = request.onblocked = () => {
          clearTimeout(timer);
          unavailable();
        };
      }).catch(() => null);
    return database;
  };
  const transact = (action) => {
    const pending = queue
      .then(async () => {
        const db = await open();
        if (!db) return;
        return new Promise((resolve) => {
          const tx = db.transaction("records", "readwrite");
          let value;
          action(tx.objectStore("records"), (result) => {
            value = result;
          });
          tx.oncomplete = () => resolve(value);
          tx.onerror = tx.onabort = () => resolve(undefined);
        });
      })
      .catch(() => undefined);
    queue = pending.then(() => {});
    return pending;
  };
  const id = (scope, kind, key) => JSON.stringify([scope, kind, key]);
  const valid = (record) =>
    record?.version === 1 &&
    Number.isFinite(record.savedAt) &&
    record.savedAt <= now() &&
    Number.isFinite(record.expiresAt) &&
    record.expiresAt > now();
  return {
    read(scope, kind, key) {
      if (!scope) return Promise.resolve(undefined);
      return transact((store, done) => {
        const request = store.get(id(scope, kind, key));
        request.onsuccess = () => {
          if (valid(request.result)) done(request.result);
          else store.delete(id(scope, kind, key));
        };
      });
    },
    write(scope, kind, key, value, ttl) {
      if (!scope || !Number.isFinite(ttl) || ttl <= 0)
        return Promise.resolve(undefined);
      const savedAt = now();
      const record = {
        id: id(scope, kind, key),
        scope,
        kind,
        version: 1,
        savedAt,
        expiresAt: savedAt + ttl,
        value,
      };
      try {
        if (
          new TextEncoder().encode(JSON.stringify(record)).byteLength >
          MAX_BYTES
        )
          return Promise.resolve(undefined);
      } catch {
        return Promise.resolve(undefined);
      }
      return transact((store, done) => {
        store.put(record);
        // Prune index keys without deserializing every cached payload.
        const expired = store.index("expiresAt").openKeyCursor();
        expired.onsuccess = () => {
          const cursor = expired.result;
          if (!cursor || cursor.key > now()) return;
          store.delete(cursor.primaryKey);
          cursor.continue();
        };
        const oldest = store.index("savedAt").openKeyCursor(null, "prev");
        let count = 0;
        oldest.onsuccess = () => {
          const cursor = oldest.result;
          if (!cursor) {
            done(true);
            return;
          }
          if (++count > MAX_RECORDS) store.delete(cursor.primaryKey);
          cursor.continue();
        };
      });
    },
    remove(scope, kind, key) {
      return transact((store, done) => {
        store.delete(id(scope, kind, key));
        done(true);
      });
    },
    clear(scope, kind) {
      return transact((store, done) => {
        const request = store.openCursor();
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) {
            done(true);
            return;
          }
          if (
            cursor.value.scope === scope &&
            (!kind || cursor.value.kind === kind)
          )
            cursor.delete();
          cursor.continue();
        };
      });
    },
  };
}
let indexedDB;
try {
  indexedDB = window.indexedDB;
} catch {
  /* Storage can be disabled. */
}
export const browserRecords = createBrowserRecords({ indexedDB });
