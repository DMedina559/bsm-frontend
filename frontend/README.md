# BSM web interface

The React application provides server management, monitoring, configuration, and
plugin interfaces for a separately running BSM backend.

Paths below are relative to the repository root unless noted otherwise.

## Development

Use Node.js 22.12 or later:

```sh
npm ci
npm run dev
```

Open the URL printed by Vite, including `/app/`. The backend proxy defaults to
`http://localhost:11325`. Set `VITE_API_URL` in `frontend/.env.local` to change the
proxy target, then restart Vite. The browser's connection settings can also select
a remote backend. An HTTPS page requires an HTTPS backend.

Installation prepares shared library output. `npm run dev` watches shared library
source and refreshes the imported modules. If you run Vite separately, also run
`npm run dev:packages` or rebuild libraries with `npm run build:packages`.

## Production builds

```sh
npm run build
```

Deploy the complete `frontend/dist/` directory, keeping its HTML and hashed assets
together. For delivery through the Python backend, use `npm run build:python`;
that command stages the web output inside the Python package. See the
[Python guide](../python/README.md#build-from-a-checkout).

The backend supplies proxy metadata through the `app-asset-base` HTML element;
`data-api-base` identifies the external API prefix. Routing, HTTP requests,
WebSockets, and assets use this metadata. Standalone hosting falls back to
pathname-based prefix detection.

Check nested navigation, page refreshes, styles, icons, authenticated downloads,
and WebSocket reconnection through the actual reverse proxy. Vite's development
proxy alone does not verify a production ingress configuration. Previously stored
HTTP backend URLs are rejected when the page is served over HTTPS.

Plugin display URLs starting with `/`, `./`, or `../` resolve against the backend
and its ingress prefix. Explicit external HTTPS URLs remain external. Built-in
assets resolve against the frontend; custom theme endpoints use the backend.

## Application structure

| Directory                  | Responsibility                                                                     |
| -------------------------- | ---------------------------------------------------------------------------------- |
| `frontend/src/api/`        | Browser credentials, API URL resolution, request lifecycle checks, downloads       |
| `frontend/src/app/`        | Composition of shared runtime/storage factories, query cache, and browser adapters |
| `frontend/src/contexts/`   | React providers and lifecycle ownership                                            |
| `frontend/src/pages/`      | Routed application screens                                                         |
| `frontend/src/components/` | Reusable interface components                                                      |
| `frontend/tests/`          | Unit tests, browser scenarios, fixtures, and type checks                           |

Providers own startup and cleanup; pages and hooks consume the application
instance. Core commands use the generated operation IDs; the command adapter
attaches task kind and server context without interpreting URL fragments. The
WebSocket provider passes this caller explicitly to `application.start()` before
starting recovery. Shared packages must not import React, DOM APIs, browser storage, or
frontend code. Application source must not import test helpers or test frameworks.

## Appearance and preferences

Appearance controls themes, personal palettes, display mode, density, panorama,
and sidebar transparency. Account settings contain profile and password controls.
The selected account theme is saved to the backend. Device preferences, personal
palettes, fleet sorting, and notification history stay in this browser, scoped by
backend and account where applicable.

Custom themes use the semantic `--bsm-*` variables in
[`src/styles/tokens.css`](src/styles/tokens.css). Administrators install shared
CSS themes in the backend's theme directory. Personal palettes support JSON
import/export and CSS export from Appearance.

The notification bell retains up to 100 messages for seven days per signed-in
account and backend. Guest history stays in memory. Clear history removes retained
messages. Preferences use memory when persistent storage is unavailable. Application
preferences share one store and the version/validation definitions in
`src/app/preferenceDefinitions.js`. Selected server, appearance, palettes, fleet
sorting, metric units and sidebar collapse are scoped by backend and account.
Legacy unscoped preferences migrate only for embedded default connections;
remote connections do not inherit ambiguous values. Logging overrides remain
device settings; the hidden-navigation flag lasts for the browser session.
Credentials belong to the separate connection adapter.

Server snapshots, tasks, metrics and drafts are not persisted as browser truth.
Background refreshes preserve dirty forms and display conflicts. Session changes
invalidate pending saves and clear application-owned drafts and operations.

Public themes and manifest icons are loaded dynamically. Keep the bundled
`public/image/panorama.png`: the backend uses it as its default panorama response,
even though the web application requests the image through the API.

## Metrics and diagnostics

Metrics groups application performance, host utilization, runtime activity, and
Bedrock processes. Pause freezes the displayed observations while backend
collection continues. Missing measurements appear as a dash. Backend in-memory
history resets on restart.

Administrators can open Diagnostics when the backend supports its API:

- **Overview:** readiness, health, findings, and subsystem status.
- **Subsystems:** subsystem observations, timing, and registered plugin details.
- **History:** retained records, filtering, and correlated events or tasks.
- **Advanced:** collector details, comparison baselines, and support reports.

Diagnostics offers manual refresh and an optional 15-second interval. Baselines
stay in memory and are discarded when leaving the view or changing sessions.
Counter comparisons are suppressed across backend restarts. History requests
start when the History view opens. Review downloaded reports before sharing them.

## Validation

From the repository root:

```sh
npm run check
npm run build
```

For interactive unit-test development:

```sh
npm run test:watch --workspace=bsm-frontend
```

Install the supported browsers and run browser scenarios:

```sh
npm exec --workspace=bsm-frontend -- playwright install chromium firefox webkit
npm run test:e2e --workspace=bsm-frontend
```

Build the production assets first with `npm run build`. Playwright serves that
compiled output at `/app/`, a standalone root, and an ingress prefix. It exercises
real cross-origin HTTP preflights and authenticated sockets against local fixture
backends, including backend changes across tabs. It does not need a running BSM
instance. Deployment-specific proxy and certificate settings still need checking
in the target environment.

The browser suite runs on Chromium, Firefox, and WebKit. The packaged-app smoke
check starts an isolated BSM instance with temporary configuration and data:

```sh
npm run build:python
python -m pip install /path/to/supported/backend
python -m pip install --force-reinstall --no-deps python/dist/*.whl
npm run test:e2e:backend --workspace=bsm-frontend
```

Use backend `dev` for integration testing. Set `BSM_BACKEND_PYTHON` if that
installation uses a different Python executable. CI runs the packaged-app check
against backend `dev` before publishing frontend distributions. Generated API
consistency, style and types are checked in the separate Lint and Types workflow.

| Test directory            | Contents                                                    |
| ------------------------- | ----------------------------------------------------------- |
| `frontend/tests/unit/`    | Component, page, utility, and runtime tests                 |
| `frontend/tests/support/` | Shared providers, HTTP fixtures, setup, contract assertions |
| `frontend/tests/e2e/`     | Playwright application scenarios                            |
| `frontend/tests/backend/` | Packaged app smoke test against the supported BSM backend   |
| `frontend/tests/types/`   | Frontend API call type checks                               |

Shared library tests live under `packages/*/test/`.

## Pre-commit hooks

Install Python's `pre-commit` package, then run these commands from the root:

```sh
python -m pip install pre-commit
pre-commit install
pre-commit run --all-files
```

The ESLint hook uses dependencies installed by root `npm ci`. pre-commit.ci skips
that system hook; GitHub Actions runs workspace lint. Keep the hook's Prettier
version aligned with the root dependency.

## Standalone deployment

Serve `frontend/dist/` with history fallback to `index.html`. The default remains
an embedded application at `/app/`; Home Assistant ingress prefixes are inferred
from backend-provided metadata or the application path.

For standalone hosting, edit the `bsm-config` JSON element in the built
`index.html` before serving it. No JavaScript rebuild is needed:

```json
{
  "mode": "standalone",
  "appBase": "/console/",
  "backendUrl": "https://bsm.example/prefix"
}
```

`appBase` controls browser routes and bundled assets; `backendUrl` controls HTTP
and WebSocket connections independently. A standalone app exposes connection
settings on the sign-in screen. The user's browser must be able to reach the
backend, which must allow the UI origin for HTTP and WebSocket connections.
An HTTPS frontend requires an HTTPS backend.

Bearer credentials are scoped to the backend origin and ingress prefix. Changing
connections cancels the previous application's work and signs out of the selected
connection. Ambiguous legacy unscoped tokens are discarded; embedded deployments
can recover an existing cookie session through reauthentication. Credentials use
memory if browser persistence is blocked. A compatibility notice compares the
backend's advertised operation IDs to the UI's pinned contract; it does not
infer compatibility from unrelated frontend and backend version numbers.

The `application` instance in `src/app/application.js` owns the runtime and cache
lifecycle. Thin module adapters preserve convenient imports for React hooks.
Use `application.reset()` at session boundaries and `application.dispose()` when
the application ends. Reconnect/fallback recovery refreshes active resources in the current session,
coalescing duplicate requests and pausing periodic resource work while hidden or
offline. Task recovery has its own owner; diagnostics intervals remain opt-in.
Package source behavior belongs in `packages/*/test/`;
browser-specific adapters and React integration remain in frontend tests.

## Browser recovery and shared sessions

Basic fleet snapshots use the disposable IndexedDB `bsm-view-state` database.
Records are versioned, scoped to the backend (including ingress prefix) and
account, expire after 24 hours, and contain only name, status, version and player
count. Player identities, credentials and configuration are excluded. A network
failure can display a dated, explicitly stale snapshot; it never enters runtime
reconciliation as a backend observation. Reconnecting refreshes it from HTTP.
The application shell and an authenticated in-memory session must already be
available; this feature does not bypass sign-in or install an offline shell.
Mutations are rejected while offline and are never queued for later replay.

**Account → Browser recovery** offers opt-in recovery of recognized global/server
settings and structured server properties. IndexedDB stores only safe changed
fields and their field baselines, for up to seven days. Restoring is explicit and
rebases those fields on fresh backend data; changed baselines show a conflict
notice. Secrets, unknown/custom fields, plugin settings, raw files and addon order
are excluded. Saving, discarding or disabling recovery removes saved edits. The
same account controls can clear cached views and saved edits. Both record types
share a 100-record cap and a 256 KB per-record limit. Unsupported schemas are
removed; disabled/failed storage falls back to ordinary in-memory editing.

When Web Locks and BroadcastChannel are available, tabs for the same backend and
account share one authenticated socket and one task discovery/polling owner.
The browser releases ownership when the owner closes; waiting tabs take over.
`pagehide` releases ownership and `pageshow` re-enters the election. Each tab
announces its topics and pending task metadata, and the owner retains their union.
Leaving or expired peers release their topics. Accepted HTTP task snapshots and
live frames pass through each tab's normal reconciliation gates. Credentials and
HTTP writes are never broadcast. Each view still owns its HTTP resource reads and
visibility-aware resource refreshes. Browsers that cannot coordinate use independent
sockets and recovery. Custom low-level socket sends are owner-only; application
commands use the generated HTTP client.

Overview cards observe a single fleet entry with a query selector and use stable
event callbacks. Structural sharing keeps unrelated cards from rendering when
another server changes; the fleet query remains the only request owner.

The administrator diagnostics screen includes opt-in frontend observations:
rejection reasons, refresh families, ownership changes, compaction counts and
subscription/reference counts. Only 200 payload-free observations are retained
in memory; reset clears them. Long-session compaction runs every 250 accepted
observations, drops expendable event payloads, and reduces old terminal tasks to
identity/status. Revisions, arrival clocks, epoch tombstones and task terminal
watermarks remain until session/epoch reset, preserving replay protection.

### Dates, times, and shared styles

Set the application timezone in BSM Settings → General. Account → Appearance →
Dates and times can display the application timezone, your browser's timezone,
or UTC. Timestamp details retain the UTC instant and original value. Raw logs
remain UTC; schedules display their explicit scheduling timezone.

Application code should use `Timestamp` for rendered instants and `useTimeFormat`
for chart labels and date grouping. Numeric timestamps require explicit seconds
when they come from metrics or diagnostics. Offset-free historical API timestamps
are interpreted as UTC. Never convert stored timestamps into formatted strings.

Use the shared `header`, `card`, `settings-panel`, `form-input`, `action-button`,
and status classes. Theme colors come from semantic `--bsm-*` tokens, and geometry
uses spacing, radius, and density tokens. Page styles should extend those rules
without redefining common control heights or introducing undefined variables.
