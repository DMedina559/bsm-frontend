# Bedrock Server Manager UI

This is the React frontend for Bedrock Server Manager, packaged as a Python library.

Application and server log viewers fetch older history when you scroll up.
Live output follows the bottom of the viewer; scrolling away pauses auto-scroll.
Use **Follow live** to return to the latest entries. History requires a backend
providing `/api/logs/history`; live frames remain compatible with earlier backends.

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
