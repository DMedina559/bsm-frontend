# BSM preference storage

Import `createPreferenceStore` and `getSessionStorageKey` from
`@bedrock-server-manager/storage`.

`createPreferenceStore(storage, definitions, events)` provides versioned,
validated, account/backend-scoped preferences without browser dependencies.

Supply synchronous `getItem`, `setItem`, and `removeItem` methods for persistence.
Omitting storage, or storage failures, falls back to instance-local memory.
Definitions can provide `version`, `validate`, and version-indexed `migrations`.

The optional events adapter supplies `addEventListener` and `removeEventListener`
for storage notifications (`key`, including null for a full clear). Listeners are
attached only while subscribers exist. The frontend supplies browser storage and
events; other consumers can supply their own implementation.

Use `getSessionStorageKey` for consistent identity scoping. Credentials are not
managed by this package.

## Workspace commands

This package remains private. Its `build` command copies executable modules and
available declarations to `dist/`, which the frontend imports through the package
exports. Installation prepares this output; rebuild after editing package source.
`test`, `lint`, and `check` run this package's own checks from the repository's
shared development tools. `npm pack` builds the package first for isolated
consumer verification; it does not publish it.
