# Bedrock Server Manager frontend workspace

The npm workspace contains the React web application and the reusable BSM API
client, runtime, and storage packages. The Python distribution delivers the
compiled web interface to Bedrock Server Manager.

## Development

Use Node.js 22.12 or later. From the repository root:

```sh
npm ci
npm run dev
```

Installation builds the shared packages automatically. The development server
proxies backend requests to `http://localhost:11325`; run the backend separately.
See [frontend development](frontend/README.md) for connection configuration,
appearance, and browser tests.

| Workspace                                              | Purpose                                                      | Distribution                              |
| ------------------------------------------------------ | ------------------------------------------------------------ | ----------------------------------------- |
| `frontend`                                             | React web application and browser adapters                   | Python package containing compiled assets |
| [`packages/api-client`](packages/api-client/README.md) | Generated API types, operation client, HTTP transport        | Public npm SDK                            |
| [`packages/runtime`](packages/runtime/README.md)       | Sessions, state reconciliation, metrics, operations, sockets | Private workspace                         |
| [`packages/storage`](packages/storage/README.md)       | Versioned preferences and persistence adapters               | Private workspace                         |

Shared packages receive platform dependencies explicitly. They do not import the
frontend or React. Credentials, DOM downloads, navigation, and browser lifecycle
integration stay in the web application.

## Commands

| Command                  | Result                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------ |
| `npm run dev`            | Build shared packages and start the web development server                                 |
| `npm run build`          | Build libraries and production web assets                                                  |
| `npm run build:packages` | Build library JavaScript, declarations, and operation metadata into each package's `dist/` |
| `npm run check`          | Check generation, lint, types, workspace tests, and isolated package consumers             |
| `npm run api:generate`   | Regenerate the SDK contract types and operation registry, then rebuild the SDK             |
| `npm run packages:check` | Pack/install packages in isolation and check their exports and consumer types              |
| `npm run build:python`   | Build the web interface and its Python wheel/source distribution                           |

Each workspace owns its `build`, `test`, and `lint` commands. Type checks are
available where a public TypeScript surface is defined. Root commands coordinate
these checks. For example, `npm run check --workspace=@bedrock-server-manager/api-client`
checks just the SDK. Rebuild libraries after changing their source while Vite is
running. Generated package output is not committed.

Python delivery requires Python 3.11 or later and `python -m pip install build`.
`npm run build:python` writes distributions to `python/dist/`; `PYTHON` can select a
Python executable. `python/build.sh` is a compatibility wrapper around this npm workflow.

## Backend installation

```sh
pip install bsm-frontend
```

Python packaging configuration, wrapper source, tests, and distribution output
live under [`python/`](python/README.md). Normal npm builds write only to
`frontend/dist/`; Python delivery copies those assets into its own package.

The backend obtains the compiled asset directory through the Python wrapper:

```python
from bsm_frontend import get_static_dir
static_files_path = get_static_dir()
```

## OpenAPI contract

The backend owns the API contract. Install `bedrock-server-manager` from the target
backend checkout and export it with:

```sh
python -m bedrock_server_manager.web.contract --output packages/api-client/src/generated/openapi.json
npm run api:generate
```

Generation belongs to the API client workspace. `npm run api:check` verifies its
committed types and operation registry. The backend-contract workflow compares
the pinned document against backend `dev`; normal package consumers do not need
a Python backend to build or use the SDK.

## Releases

The SDK and frontend distribution have independent versions and release tags.
The private root workspace has no published version.

- **SDK:** update `packages/api-client/package.json` and the root lockfile, commit,
  and publish a GitHub release tagged `api-client-v<package version>`. The npm
  workflow verifies the version, checks the SDK and packed consumer, and publishes
  only `@bedrock-server-manager/api-client`. GitHub prereleases use npm's `next`
  tag; other releases use `latest`. Configure the `npm-release` environment's
  `NPM_TOKEN` secret with permission to publish under the package's npm scope.
- **Frontend/Python:** existing frontend release tags continue through the PyPI
  workflow and `release` environment. The full shared validation workflow must
  pass before publishing. SDK tags are excluded from this release path and from
  Python/frontend version discovery.

Runtime and storage remain private and have no registry publication workflow.
Workspace links let the frontend consume the SDK without tying its version to
the SDK release number. No npm package is published by installation or build.

## Application monitor

The Metrics view groups application performance, host utilization, runtime activity, and Bedrock processes. CPU and memory charts show recent observations using your preferred units. Pause updates to freeze the displayed snapshot; backend collection continues. History is held in backend memory and resets on restart. Missing measurements appear as a dash, not zero.

Administrators can also open Diagnostics on a backend with the diagnostics API:

- **Overview:** readiness, health, findings, and subsystem status at a glance.
- **Subsystems:** concise observations with expandable technical details and source timing. Search registered plugins and inspect their runtime status and owned work.
- **History:** filter and page retained records across restarts, then inspect correlated events, tasks, and records. Sources report availability independently.
- **Advanced:** inspect collector and installation metadata, save an in-memory comparison baseline, and compare fresh observations. Counter deltas are suppressed across restarts.

Refresh manually or enable a 15-second interval while Diagnostics is open. Unknown plugin status means the backend could not resolve its runtime status; it does not prove the plugin is loaded. Missing timestamps mean no corresponding timestamp was reported. Stale observations retain their source timing.

Download an authenticated support report and review it before sharing. Baselines and reports are not saved in browser storage. Leaving Diagnostics discards the baseline; account/session changes invalidate pending work. History requests start only when you open History.

## Reverse proxies and ingress

The production backend serves one `app-asset-base` element with `data-api-base`
containing the external proxy prefix. The router, HTTP client, WebSocket
client, and bundled assets use this runtime metadata. Standalone frontend
hosting retains pathname-based detection as a fallback. Build assets with
`npm run build`; test the production build through BSM rather than relying
only on Vite's development proxy.

An HTTPS page requires an HTTPS remote backend. The connection dialog and
HTTP/WebSocket resolvers reject mixed-content configurations, including
previously stored HTTP URLs. Direct HTTP remains supported on an HTTP page.

Plugin display URLs beginning with `/`, `./`, or `../` are backend-relative
and receive the configured backend or ingress prefix once. App-navigation links remain on the frontend origin. Explicit external
HTTPS URLs remain external. Bundled UI assets always resolve on the frontend
origin; custom theme endpoints resolve on the backend origin. Token changes
and proxy paths should be exercised alongside navigation, nested refreshes,
assets, plugin content, downloads, and WebSocket reconnection.
