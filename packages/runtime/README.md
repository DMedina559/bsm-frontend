# BSM application runtime

A private workspace package for session cancellation, HTTP/WebSocket state
reconciliation, metrics, draft tracking, operation coordination, and recovery.
It imports neither React nor a query-cache implementation.

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

The frontend composes individual module factories through its
[`src/app` adapters](../../frontend/src/app). Pure query keys, event mappings,
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
`bsm:socket-connected`. The frontend's
[`browserPlatform`](../../frontend/src/app/browserPlatform.js) is a concrete adapter.
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

The session module can be used independently within the workspace:

```js
import { createSessionRuntimeModule } from "@bedrock-server-manager/runtime/sessionRuntime";

const { sessionRuntime } = createSessionRuntimeModule();
const previous = sessionRuntime.capture();
sessionRuntime.reset();
console.log(previous.signal.aborted); // true
```

Start WebSocket managers and operation recovery explicitly, and retain their
returned cleanup functions. Call them when the owning session or provider ends.
Session reset also stops sockets and recovery, removes their platform listeners,
clears their timers, and aborts pending recovery requests. Cleanup functions are
idempotent. Starting the same WebSocket manager again replaces its previous
owner; the previous cleanup function cannot stop the new connection.

Reset the session before changing accounts or backends so pending work becomes
stale. The application also owns clearing its cache and operation list at that
boundary; session cancellation is not a replacement for cache cleanup.

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
builds the package for isolated consumer checks. This package is private and has
no registry publication workflow.

`npm run packages:check` from the root packs and installs all shared packages in
an isolated project. It checks runtime exports against their declarations,
compiles consumer examples, and runs the runtime lifecycle tests against the
installed archive. Those tests reject browser-global access during import and
execution and exercise authentication, retries, reconciliation, cancellation,
and session cleanup using an injected platform and scheduler.
