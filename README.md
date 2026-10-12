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
