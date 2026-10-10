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
