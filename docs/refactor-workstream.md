# BSM Frontend 4.0 — execution workstream

## Objective
Complete the frontend storage/state/runtime migration against backend `refactor!/move-api-to-pydantic` without regressions in authentication, ingress, WebSocket updates, plugins, or existing views.

## Working branch
`refactor/application-state` (based on `dev`). Do not merge until all gates pass.

## Execution protocol
1. Inspect exact frontend callers and backend contracts before editing.
2. Implement one coherent task, with focused regression tests.
3. Run `npm ci`, `npm run lint`, `npm run test:run`, and `npm run build`.
4. Fix failures before marking a task complete.
5. Commit using the repository's conventional style; update this checklist and the progress log.
6. Do not modify backend or merge branches without explicit authorization.
7. Do not claim tests passed without execution evidence.
8. Resume at the first unchecked task; record blockers and exact next action.

## P0 — stabilize current migration
- [ ] T01 Regenerate and commit `frontend/package-lock.json`; verify `npm ci`.
- [ ] T02 Verify App provider mounting, lint, test, build; repair all failures.
- [ ] T03 Fix WebSocket reconnect generation, resubscription and auth timeout behavior.
- [ ] T04 Remove duplicate player-event cache writes; centralize event reconciliation.
- [ ] T05 Correct session/logout/401 cleanup, cancel in-flight requests, scope selection by account.
- [ ] T06 Add tests for reconnect, malformed events, HTTP-vs-WS races, logout and account switching.

## P1 — consolidate application state
- [ ] T07 Inventory HTTP callers, WebSocket topics, and backend Pydantic payloads at pinned commits.
- [ ] T08 Introduce typed OpenAPI client generation with CI drift checks.
- [ ] T09 Standardize query keys, fetch hooks, invalidation and error policies.
- [ ] T10 Add a versioned UI preference store; migrate only UI-owned state.
- [ ] T11 Migrate Overview, Online Players and Monitor to shared query hooks.
- [ ] T12 Migrate server settings, backups, content, users and plugins incrementally.
- [ ] T13 Remove compatibility contexts only after all consumers migrate.

## P2 — runtime and operations
- [ ] T14 Define event payload contracts and revision/correlation strategy with backend.
- [ ] T15 Implement operation lifecycle coordination (install/start/stop/backup/restore).
- [ ] T16 Handle task subscription snapshot replay, completion and reconnect reconciliation.
- [ ] T17 Add bounded retries, cancellation, visibility-aware polling and diagnostics.
- [ ] T18 Run full frontend integration suite and backend contract smoke tests.
- [ ] T19 Final architecture audit, remove dead state paths and prepare merge PR.

## Acceptance criteria
- All frontend CI commands pass on a clean checkout.
- No duplicated server data stores or competing event reducers.
- Auth/session changes cannot expose another user's cached data.
- WebSocket reconnect restores desired subscriptions and catches up state.
- Late HTTP results cannot overwrite fresher player updates.
- Server operations and installation transitions complete correctly.
- Existing UI routes, plugins, theme preferences and ingress paths remain functional.

## Known starting state
The branch already has query keys, a QueryClient provider, auth cache cleanup, a ServerContext query adapter, and initial WebSocket synchronization tests. Those changes have NOT yet passed a verified clean build. `package-lock.json` is not yet updated for TanStack Query.

## Current next action
T01: regenerate the lockfile in the configured development environment; then run all gates in T02.
