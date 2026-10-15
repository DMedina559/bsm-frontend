# Bedrock Server Manager UI

This is the React frontend for Bedrock Server Manager, packaged as a Python library.

## Installation

```bash
pip install bsm-frontend
```

## Usage

```python
from bsm_frontend import get_static_dir

static_files_path = get_static_dir()
print(f"Static files are located at: {static_files_path}")
```

## OpenAPI contract

Install `bedrock-server-manager` from the target backend checkout. Export with `python -m bedrock_server_manager.web.contract --output frontend/src/api/generated/openapi.json`, then run `npm run api:generate` in `frontend`. CI compares the complete document with backend `dev` using the backend-owned exporter and its declared dependencies.

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
