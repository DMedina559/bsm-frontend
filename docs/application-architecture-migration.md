# Frontend application architecture migration

Target: backend `refactor!/move-api-to-pydantic`, frontend `refactor/application-state` (from `dev`).

## Verified current behavior

- `frontend/src/api.js` owns authenticated fetch and ingress-aware URL validation.
- `frontend/src/WebSocketContext.jsx` already owns one connection, reconnects, reference-counted subscriptions, and message listeners. Preserve this behavior during migration.
- `frontend/src/ServerContext.jsx` fetches `/api/servers`, stores selection in localStorage, applies validated player-change events, and falls back to polling.
- Backend `web/routers/websocket.py` validates authentication and client frames with Pydantic. It supports subscribe/unsubscribe/request/request_data, and replays task snapshots after `task:<id>` subscriptions.
- Backend `web/websocket_manager.py` supports topic broadcasts, wildcard subscribers, plugin data providers, and custom `ws_event:<event>` notifications.
- Backend `web/schemas/websocket.py` types client frames and responses but does not describe every event payload.

## Migration invariants

1. Backend is authoritative for servers, users, plugins, tasks and settings.
2. Query cache owns fetched server data; UI stores own only presentation state and selection.
3. Never create competing copies of server lists in Zustand and TanStack Query.
4. Keep existing auth token behavior, proxy/ingress paths, and request URL origin validation.
5. Preserve WebSocket topic names, authentication handshake, and task snapshot replay.
6. Subscribe before depending on task events; reconcile task state on reconnect.
7. For event payloads, use exact backend schemas. Apply validated targeted patches; otherwise invalidate the affected query.
8. Reset user-scoped caches and subscriptions on logout/account change.
9. Preserve existing React routes, plugin views, themes, and dashboard layout options.
10. Keep the old context APIs as compatibility adapters while migrating features.

## Execution order

1. Inventory all HTTP callers, context consumers, WebSocket event publishers and topic payloads.
2. Export the backend OpenAPI contract at a pinned commit; generate a client in CI and detect contract drift. Preserve the existing fetch transport while adapting generated operations.
3. Introduce TanStack Query and shared query keys; migrate the server list with a compatibility `useServer` adapter.
4. Move WebSocket event-to-cache synchronization to one module; test malformed/out-of-order payloads, reconnect, task snapshot replay, and player updates.
5. Add a small persisted UI store for selection and layout preferences; keep backend account preferences authoritative when available.
6. Migrate features one at a time and delete legacy state only after consumer and integration test parity.

## Backend follow-ups to evaluate

- Publish an explicit JSON Schema catalog for named WebSocket events (OpenAPI alone cannot express all WebSocket payloads).
- Consider stable event identifiers, timestamps/revisions and correlation IDs to reconcile delayed/out-of-order messages.
- Check authorization for topic subscriptions and data providers, especially plugin topics and wildcard subscriptions.
- Inventory which lifecycle events include server name, outcome and result data before writing frontend reducers.
