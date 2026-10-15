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

Installation prepares shared library output. If you edit a library while Vite is
running, run `npm run build:packages` to refresh the imported modules.

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
instance. Shared packages must not import React, DOM APIs, browser storage, or
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
messages. Preferences use memory when persistent storage is unavailable.

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

Install Chromium and run browser scenarios:

```sh
npm exec --workspace=bsm-frontend -- playwright install chromium
npm run test:e2e --workspace=bsm-frontend
```

Playwright starts its own development server. Its fixtures supply API responses;
the browser suite does not require a live backend. Production proxy behavior still
needs validation against a deployed backend.

| Test directory            | Contents                                                    |
| ------------------------- | ----------------------------------------------------------- |
| `frontend/tests/unit/`    | Component, page, utility, and runtime tests                 |
| `frontend/tests/support/` | Shared providers, HTTP fixtures, setup, contract assertions |
| `frontend/tests/e2e/`     | Playwright application scenarios                            |
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
