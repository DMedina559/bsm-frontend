# BSM frontend Python distribution

This package delivers the compiled BSM web interface to the Python backend.
The wrapper's public API remains `bsm_frontend.get_static_dir()`.

## Installation

```sh
pip install bsm-frontend
```

```python
from bsm_frontend import get_static_dir
static_files = get_static_dir()
```

## Building from the repository

Install Node.js 22.12 or later, Python 3.11 or later, and Python's build tooling:

```sh
python -m pip install build
npm ci
npm run build:python
```

Run npm commands from the repository root. The build creates `frontend/dist/`,
copies it into `python/src/bsm_frontend/static/`, and builds the wheel and source
archive under `python/dist/`. These generated directories are not committed.
Each packaging run replaces the copied assets and previous distribution output.
`PYTHON` can select the Python executable used by the npm build.

`python/build.sh` is a compatibility wrapper that installs npm dependencies and
runs the same build. The source archive includes the copied web assets, so wheel
builds from that archive do not require Node.js.

## Tests and releases

From the repository root, install pytest and run:

```sh
python -m pip install pytest
PYTHONPATH=python/src python -m pytest -c python/pyproject.toml python/tests
```

The Python release workflow validates and publishes `python/dist/` to PyPI.
Version discovery uses frontend release tags in the parent repository and ignores
SDK tags. See the [workspace release guide](https://github.com/DMedina559/bsm-frontend#releases) for the separate
SDK release process.
