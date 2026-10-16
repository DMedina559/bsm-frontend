# BSM preference storage

A private workspace package for validated, versioned preferences. Persistence and
change notifications are injected; the package does not use browser globals.
It does not manage credentials.

## Basic usage

This example uses instance-local memory:

```js
import { createPreferenceStore } from "@bedrock-server-manager/storage";

const store = createPreferenceStore(undefined, {
  density: {
    version: 1,
    validate: (value) =>
      typeof value === "string" && ["comfortable", "compact"].includes(value),
  },
});
const identity = JSON.stringify(["https://bsm.example", "user-1"]);

store.write(identity, "density", "compact");
console.log(store.read(identity, "density", "comfortable")); // compact
```

Use an identity containing both backend and account information when values must
be isolated between connections. `getSessionStorageKey` is also exported for
consistent key construction. Empty identities do not produce preference keys.

## Persistence and subscriptions

`createPreferenceStore(storage, definitions, events)` accepts these adapters:

| Adapter   | Methods                                                                             |
| --------- | ----------------------------------------------------------------------------------- |
| `storage` | Synchronous `getItem(key)`, `setItem(key, value)`, and `removeItem(key)`            |
| `events`  | Optional `addEventListener("storage", callback)` and matching `removeEventListener` |

Stored values use a JSON envelope containing `version` and `value`. The frontend
supplies browser persistence through its
[`preferenceStore` adapter](../../frontend/src/app/preferenceStore.js).
If storage is omitted or a persistence operation fails, values fall back to
memory within that store instance. They do not survive creating a new instance.

`subscribe(identity, name, callback)` returns an unsubscribe function. Local writes
notify subscribers. External storage events provide a `key`; a null key indicates
a full clear. The store attaches an external listener only while subscribers
exist and removes it after the final subscription ends.

## Validation and migrations

A preference definition may provide:

- `version`: the current stored version, defaulting to `1`.
- `validate(value)`: validation applied before writes and when reading values.
- `migrations`: functions indexed by the previous version number.

A migration transforms the previous value into the next version's value. The store
applies migrations one version at a time, validates the result, and writes the
updated envelope. Invalid data, missing migration steps, or an unsupported stored
version return the caller's fallback value.

`read` can also receive a caller-specific validator. `write` and `remove` return
whether the operation was accepted; a successful write may have used memory
fallback rather than persistent storage. Subscriber failures are isolated so a
completed write still returns normally and other observers are notified.

## Workspace commands

From the repository root:

```sh
npm run build --workspace=@bedrock-server-manager/storage
npm run check --workspace=@bedrock-server-manager/storage
```

Installation prepares `dist/`; rebuild it after changing source. The package owns
its tests, lint, and consumer type checks. It is private and has no registry
publication workflow.
