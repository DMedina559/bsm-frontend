# BSM application runtime

Private, experimental package for session cancellation, revision/epoch ordering,
HTTP/event reconciliation, metrics, draft tracking, operation coordination and
recovery, and the authenticated WebSocket protocol.

`createApplicationRuntime` creates isolated instances. Supply an application-owned
query cache, backend identity callback, API operation caller, WebSocket URL resolver,
logger, and platform adapter. The cache follows the query-client methods used by
the runtime; the package does not import React or a cache implementation.

The platform adapter provides:

- `isOnline()` and `isVisible()` for current lifecycle state.
- `getToken()` for the current WebSocket credential.
- `createWebSocket(url)` returning a standard WebSocket-compatible connection.
- `connected()` to publish an authenticated connection notification.
- `addEventListener(type, callback)` and `removeEventListener(type, callback)` for
  `online`, `offline`, `visibilitychange`, and `bsm:socket-connected` events.

The frontend composes the individual module factories through small adapters to
preserve its existing import surface. Factories accept explicit dependencies and
allocate their state only when called. Pure query keys, event mappings, and
response validators are available as separate exports.

Start socket managers and operation recovery explicitly; retain their returned
cleanup functions. Reset the session before changing accounts/backends or clearing
application caches. Cleanup stops timers and subscriptions; session generations
reject stale work. Each runtime requires its own query cache for full isolation.
