# BSM application runtime

A reusable package for session cancellation, HTTP/WebSocket state
reconciliation, metrics, draft tracking, operation coordination, and recovery.
It imports neither React nor a query-cache implementation.

```sh
npm install @bedrock-server-manager/runtime
```

## Integration

`createApplicationRuntime` from `@bedrock-server-manager/runtime` creates an
isolated runtime. Supply these application-owned dependencies:

| Dependency              | Responsibility                                                                |
| ----------------------- | ----------------------------------------------------------------------------- |
| `queryClient`           | Query cache compatible with the methods listed below                          |
| `getBackendIdentity()`  | Return the current canonical backend identity, including any ingress prefix   |
| `callOperation`         | Call authenticated backend operations                                         |
| `resolveWebSocketUrl()` | Return the socket URL for the current backend                                 |
| `platform`              | Provide credentials, sockets, and lifecycle notifications                     |
| `logger`                | Optional debug, warning, and error logging                                    |
| `scheduler`             | Optional timers, clock, and retry randomness; standard timers are the default |

The cache must implement `cancelQueries`, `invalidateQueries`, `removeQueries`,
`resetQueries`, `setQueriesData`, and `fetchQuery` with TanStack QueryClient-compatible behavior.
Use a separate cache for each runtime that must be isolated.

`runtime.refreshResources(queryKeys, afterCancel?)` batches duplicate resource
refreshes within a scheduling cycle. It cancels obsolete reads before refetching;
an optional callback can restore accepted event patches after cancellation.
Session, backend and epoch tickets guard both queued work and continuations.
The application reconciler and operation completion share this refresh policy.
The host decides which active resources need reconnect/fallback refreshes.

The frontend composes individual module factories through its
`frontend/src/app` adapters. Pure query keys, event mappings,
and diagnostic validators are available through separate package exports.

## Platform adapter

| Method                                | Contract                                              |
| ------------------------------------- | ----------------------------------------------------- |
| `isOnline()`                          | Return whether connection attempts can proceed        |
| `isVisible()`                         | Return whether the application is foregrounded        |
| `getToken()`                          | Return the current WebSocket credential synchronously |
| `createWebSocket(url)`                | Return a standard WebSocket-compatible object         |
| `connected()`                         | Publish an authenticated-connection notification      |
| `addEventListener(type, callback)`    | Register a lifecycle listener                         |
| `removeEventListener(type, callback)` | Remove a registered listener                          |

Lifecycle events are `online`, `offline`, `visibilitychange`, and
`bsm:socket-connected`. The frontend's `frontend/src/app/browserPlatform.js`
is a concrete adapter.
The package itself does not read browser globals. It uses standard `AbortController`,
`AbortSignal.any`, and `DOMException` APIs for cancellation.

An optional `scheduler` supplies `setTimeout`, `clearTimeout`, `setInterval`,
`clearInterval`, `queueMicrotask`, `now`, and `random`. Timer handles are opaque to
the runtime. Inject the scheduler when the host owns scheduling or deterministic
retry behavior is needed; otherwise standard JavaScript timers are used.

Every executable export includes TypeScript declarations. The root export also
provides `RuntimeOptions`, `ApplicationRuntime`, `RuntimePlatform`,
`RuntimeScheduler`, and `QueryClient` types for host implementations. Subpath
exports declare their module factories and dependency contracts.

## Session ownership and cleanup

The session module can also be used independently:

```js
import { createSessionRuntimeModule } from "@bedrock-server-manager/runtime/sessionRuntime";

const { sessionRuntime } = createSessionRuntimeModule();
const previous = sessionRuntime.capture();
sessionRuntime.reset();
console.log(previous.signal.aborted); // true
```

`runtime.start({ identity, generation, onMessage, onState })` starts a single
socket/recovery owner and returns `{ manager, stop }`. Supplying an existing
manager preserves view subscriptions across owner changes. Starting again
replaces the previous owner; stale cleanup cannot stop the new one.

When composing low-level modules, start WebSocket managers and operation recovery explicitly, and retain their
returned cleanup functions. Call them when the owning session or provider ends.
Session reset also stops sockets and recovery, removes their platform listeners,
clears their timers, and aborts pending recovery requests. Cleanup functions are
idempotent. Starting the same WebSocket manager again replaces its previous
owner; the previous cleanup function cannot stop the new connection.

Reset the session before changing accounts or backends so pending work becomes
stale. For a composed runtime, call `runtime.reset()` to stop the active owner, reset
the session, clear drafts and operations, and clear the host cache. The cache may
provide `clear()`; otherwise the runtime removes all queries. `runtime.dispose()`
performs the same cleanup when the host ends. Low-level `sessionRuntime.reset()`
only cancels session work; it does not replace full application cleanup.

Factories allocate their state when called. Do not share mutable instances across
accounts that require isolation. Revision and epoch reconciliation coordinates
HTTP snapshots with live events; the backend remains authoritative.

## Workspace commands

From the repository root:

```sh
npm run build --workspace=@bedrock-server-manager/runtime
npm run check --workspace=@bedrock-server-manager/runtime
```

Installation prepares `dist/`; rebuild it after editing package source. `npm pack`
builds the package for isolated consumer checks. GitHub releases tagged
`runtime-v<SemVer>` publish this package independently; prereleases use npm's
`next` distribution tag.

Unavailable tasks have a local `availability` state. A 404 stops polling without
fabricating a backend revision or replacing the last authoritative snapshot.
Discovery after reconnect can restore availability from the backend.

Package algorithm tests use Vitest with injected cache, command and platform
boundaries. Native Node lifecycle tests also run against installed archives.
Frontend tests retain real query-cache/provider integration and browser behavior.

Shared JavaScript implementations are checked against typed dependency and
factory return contracts by root `npm run check:implementations`. Consumer types
are also compiled from installed archives. Dynamic backend payloads remain
validated at reconciliation boundaries.

A supplied manager can implement `subscribeOwnership(listener)`, immediately
reporting whether this runtime owns task recovery and notifying on changes.
`start()` starts discovery/polling only for the owner and aborts it on ownership
loss. Ordinary managers omit this method and keep the existing independent
behavior. Cross-tab transport and IndexedDB remain frontend browser adapters.

`runtime.diagnostics` exposes `getSnapshot`, `subscribe`, `setEnabled`, `clear`,
and payload-free `record`/`subscriptions` methods. Recording is opt-in, capped at
200 observations and cleared at session reset. Policy labels identify rejection
and refresh causes without storing query keys, values, URLs or identities.

`stateReconciler.onObservation(listener)` observes accepted records; its cleanup
removes the listener. Browser adapters can share accepted task reads without
bypassing reconciliation in receiving runtimes. `stateReconciler.compact()`
releases obsolete payloads and returns record/payload/compaction counts. Automatic
compaction runs every 250 accepted observations. It preserves ordering clocks,
revisions, terminal identities/status, resource membership tombstones and retired
epochs. Small replay watermarks intentionally grow with unique resource/task IDs
until reset; compaction bounds large payload retention rather than weakening
correctness with an arbitrary watermark eviction limit.
