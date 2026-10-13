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

## Diagnostics

Administrators can open **Metrics → Diagnostics** on a backend with the diagnostics API. The tab separates readiness from diagnostic health and shows runtime, event, state/storage, task, plugin, process, transport, and collector observations. Null measurements remain unavailable; stale readings retain their last successful collection time.

Refresh manually or enable a 15-second interval while the view is open. Use history filters and pagination to inspect retained records across application restarts, and open a correlation trace to connect events, tasks, and history. Each source reports availability independently.

Save a comparison baseline to inspect later observations; counter deltas are suppressed across restarts. Download a support report through the authenticated API and review it before sharing. Baselines and reports are not saved in browser storage. Access changes and session changes close the view and invalidate pending work.
