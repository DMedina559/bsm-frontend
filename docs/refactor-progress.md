# Refactor progress log

## 2026-10-08 — workspace bootstrap
- Working branch: `refactor/application-state`
- Created reproducible Node 22 devcontainer configuration.
- Created task sequence and acceptance criteria in `docs/refactor-workstream.md`.
- Local container has Node 22, npm 10 and Git, but GitHub DNS resolution failed, preventing clone and npm verification here.
- Previous code commits remain unverified by a clean test/build run.
- **Next:** T01 lockfile generation, then T02 verification. Do not mark these complete until commands actually pass.

## Update format for each future task
- Task ID:
- Files changed:
- Tests run and results:
- Commit SHA:
- Blockers:
- Next task:

## 2026-10-08 — incremental runtime hardening
- Updated `WebSocketContext.jsx` to retain desired topic subscriptions across connection cleanup and use the latest connect callback for manual reconnect.
- Updated `AuthContext.jsx` to clear query cache on failed account verification.
- These changes are committed, but T03 and T05 remain **in progress**, not complete.
- Verification blocked: no successful local dependency installation, lint, tests or build in this session.
- Next: regenerate `package-lock.json` in an npm-enabled checkout; run the complete test suite; then add connection-generation and account-switch regression tests.

## 2026-10-08 — centralized event ownership
- Removed the second player-event query write from `ServerContext.jsx`; its revision tracker still protects late HTTP responses.
- Added a lifecycle invalidation test to `synchronizeServerEvent.test.js`.
- T04 is partially addressed but remains open pending verified tests and broader event payload review.
- Git clone from the available execution container still fails DNS resolution for `github.com`; no local npm verification was possible.
- **Next:** repair lockfile in an environment with registry access and run CI gates; add WebSocket reconnect/identity-switch tests before marking T03 complete.

## 2026-10-08 — session and operation infrastructure
- Added `app/sessionBoundary.js` with query cancellation/clear helper and account-scoped storage keys, plus unit tests.
- Changed `ServerContext` selected-server preference storage to use an identity-specific key.
- Added `app/operationCoordinator.js` and tests for task updates, terminal states, and clearing.
- Connected authenticated WebSocket task frames to the operation coordinator.
- Clear registered operations on auth failure, account change and logout.
- **Not complete:** task subscriptions and correlation IDs are not yet wired into page-level operations; generated OpenAPI client, versioned UI store and migrations remain outstanding.
- **Verification:** no clean npm install/lint/test/build has been executed for these commits. Lockfile remains outdated.
- **Next:** run clean build and tests in Codespaces; inspect backend task snapshot shapes, add task subscriptions, and migrate install lifecycle with integration coverage.

## 2026-10-09 — operation subscription lifecycle and React state safety
- WebSocket runtime now tracks active registered operation IDs and reference-counts `task:<id>` subscriptions, including replay after reconnect.
- Operation coordinator recognizes terminal status at registration, not just subsequent updates.
- Auth identity tracking moved outside the React state updater; cache/operation cleanup happens on actual identity transitions, auth failure, and logout.
- No build/test execution was possible in this session; task subscription semantics still require backend integration coverage.
- Next: update npm lockfile, verify CI, and migrate actual install/backup operation callers to register backend task IDs.

## 2026-10-09 — reconnect guard and operation edge-case coverage
- Guarded manual/visibility-triggered WebSocket reconnect when there is no authenticated identity.
- Added operation coordinator tests for initial terminal status and backend `task_id` snapshots.
- Simplified server selection initialization and removed an unused event-listener effect dependency.
- These commits are **not verified by npm test, lint, or build**. Lockfile regeneration and actual backend task integration remain the next gates.
