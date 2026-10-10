# Frontend WebSocket state ownership

`WebSocketProvider` owns core event subscriptions for the authenticated session.
`applicationState` admits frames using the shared revision/epoch reconciler before
publishing cache changes or notifying page/plugin listeners. API event payloads
contain flattened request fields and `result`; revision and epoch live on the
envelope. Only successful after-events refresh resource caches. Before-events
are activity/cancellation hooks, not evidence that a mutation completed.

| Backend messages | Frontend handling |
| --- | --- |
| Server start, stop, status, install, update, deletion | Fleet patches, lifecycle ordering, monitor refresh and deletion tombstones |
| Server player changes | Validated fleet/player patches |
| Global and server setting updates | Settings/bootstrap or matching server settings refresh |
| Property changes | Matching properties and fleet refresh |
| Allowlist, permissions and bans | Matching server access resource refresh |
| Player additions and database scans | Global player database refresh |
| Addon import, enable, disable, subpack, uninstall, reorder | Matching installed addons and content refresh |
| Backup creation/pruning | Matching backup list refresh |
| Restore | Matching server resources, monitor and fleet refresh |
| World import/reset/export | Properties/fleet or content refresh |
| Plugin status changes | Plugin list/detail refresh |
| Download cache pruning | Download cache refresh |
| Command completion | Audit refresh; command output remains a log stream |
| `task_update` | Shared task gate, task list and operation coordinator; task topics replay latest snapshots |
| `resource_update` | Validated monitor cache patches; topic subscribed while monitor is mounted |
| Log frames | Monitor's bounded log buffer and paginated history; subscribed on demand |
| Custom plugin broadcasts/provider responses | Forwarded to registered listeners; arbitrary plugin data is not treated as core state |
| Authentication/subscription responses | Connection manager protocol handling |

Mutation refreshes cancel matching pre-event reads before invalidating their
queries. Reordered or repeated revisioned events are rejected. Reconnect refreshes
all cached resources, including inactive resources marked stale for their next
mount. Socket fallback refreshes active resources every minute. Session/backend
changes dispose subscriptions and obsolete requests; an epoch reset isolates each
cleanup listener so one failure cannot prevent other cleanup.

Not every backend mutation currently emits an event: user/account administration,
content file operations, global settings reload and plugin reload are examples.
These continue using their HTTP mutation invalidations, query focus refresh,
reconnect refresh and socket fallback polling. A frontend subscription cannot
observe an event the backend does not emit. Cross-client immediate updates for
these operations require a separate backend event contract.

Completed task snapshots retain their ordering/status metadata after dismissal or
UI-history eviction, but release result payloads and error details. Task query
caches and displayed operations retain the full snapshots while needed. Drafts
track the pre-save backend value while awaiting a refreshed snapshot, avoiding a
false conflict warning when the user edits again after saving.
