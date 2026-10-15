# Bedrock Server Manager frontend

React web interface for Bedrock Server Manager. The Python backend runs separately.

## Development

Install dependencies from the repository root with `npm ci` using Node.js 22.12
or later. Start Vite with `npm run dev` from this directory, or use
`npm run dev --workspace=bsm-frontend` from the root. Open the printed `/app/` URL.

The development proxy targets `http://localhost:11325`. Set `VITE_API_URL` in
`frontend/.env.local` to use another backend. Browser connection settings can
select a remote backend; HTTPS pages require HTTPS backends.

See the [workspace guide](../README.md#workspace-development) for shared packages,
validation commands, and OpenAPI generation.

## Production

Run `npm run build` from the repository root. Vite replaces
`src/bsm_frontend/static` with the complete production bundle used by the Python
package. Deploy its HTML and hashed assets together. `build.sh` installs the
locked workspace dependencies, builds the interface, and builds the Python
package; it requires Python's `build` package.

The backend supplies the external ingress prefix through runtime HTML metadata.
Test nested navigation, refreshes, assets, HTTP requests, and WebSockets behind
the actual reverse proxy. See [reverse proxies and ingress](../README.md#reverse-proxies-and-ingress).

## Application integration

`src/api` configures the shared API client with browser credentials, backend URL
resolution, session checks, and operation tracking. Browser downloads stay here.
`src/app` composes shared runtime and storage factories with the application
query cache and browser lifecycle adapter. React providers own startup/cleanup;
hooks and pages consume that application instance.

Shared packages must not import the frontend, React, browser storage, or DOM
APIs. Browser-specific behavior belongs in these adapters.

## Appearance and preferences

Appearance manages themes, personal palettes, display mode, density, panorama,
and sidebar transparency. Account settings manage the profile and password.
Account theme selection is saved to the backend. Device preferences, fleet sorting,
personal palettes, and notification history stay in this browser, scoped by
backend and account where applicable.

Custom themes use semantic `--bsm-*` variables from `src/styles/tokens.css`.
Administrators install shared CSS themes through the backend's theme directory.
Personal palettes support JSON import/export and CSS export from Appearance.

The notification bell retains up to 100 messages for seven days per signed-in
account/backend. Guest history stays in memory. Clear history removes retained
messages. Preference storage falls back to memory if persistence is unavailable.

## Validation and hooks

From the repository root, run `npm run lint`, `npm run typecheck`,
`npm run api:check`, `npm test`, `npm run packages:check`, and `npm run build`.
Run browser tests with `npm run test:e2e --workspace=bsm-frontend` after installing
Chromium using `npm exec --workspace=bsm-frontend -- playwright install chromium`.

Install Python's `pre-commit` package and run `pre-commit install` from the root.
`pre-commit run --all-files` checks formatting and workspace lint. The ESLint hook
uses the dependencies installed by root `npm ci`; pre-commit.ci skips that system
hook, while GitHub Actions runs it. Keep the hook's Prettier version aligned with
the workspace dependency.

## Test layout

Tests live outside application source under `tests/`:

- `unit/` mirrors the source directories for component, page, and runtime tests.
- `support/` contains shared providers, HTTP fixtures, contract validation, and setup.
- `e2e/` contains Playwright browser scenarios.
- `types/` checks the frontend's generated API call signatures.

Shared package tests remain beside their packages under `packages/*/test`.
Application source must not import test helpers or test frameworks.

Public theme stylesheets and manifest icons are loaded dynamically. The bundled
`public/image/panorama.png` is the backend's default panorama response; it is
required even though the frontend requests it through an API operation.
