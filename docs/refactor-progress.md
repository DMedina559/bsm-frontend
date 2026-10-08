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
