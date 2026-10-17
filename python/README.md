# BSM frontend Python distribution

This package delivers compiled BSM web assets to the Python backend. It exports
`bsm_frontend.get_static_dir()`, which returns the installed asset directory as a
`pathlib.Path`.

## Install a published release

```sh
python -m pip install bsm-frontend
```

```python
from bsm_frontend import get_static_dir

static_files = get_static_dir()
```

Installing a wheel does not require Node.js. The package supplies assets; it does
not start the BSM backend or a web server.

## Build from a checkout

Use Node.js 22.12 or later and Python 3.11 or later. From the repository root,
using the Python environment intended for packaging:

```sh
python -m pip install build
npm ci
npm run build:python
```

The build creates `frontend/dist/`, copies it into
`python/src/bsm_frontend/static/`, and builds the wheel and source archive under
`python/dist/`. Generated outputs are not committed. Each packaging run replaces
the copied assets and previous distribution output.

Set `PYTHON` to select a different Python executable. In PowerShell, for example:

```powershell
$env:PYTHON = "C:\Path\To\python.exe"
npm run build:python
```

`python/build.sh` is a Bash compatibility wrapper that installs npm dependencies
and runs the same build. npm commands are the primary cross-platform interface.
The generated source archive includes compiled assets; from an extracted archive,
`python -m build` can build a wheel without Node.js.

## Install a local build

After a successful repository build, use the wheel under `python/dist/`.

PowerShell:

```powershell
python -m pip install --force-reinstall (Get-ChildItem python/dist/*.whl).FullName
```

Bash:

```sh
python -m pip install --force-reinstall python/dist/*.whl
```

Restart the backend after replacing its installed frontend distribution.

## Tests

From the repository root, in a Python development environment:

```sh
python -m pip install --editable "./python[dev]"
python -m pytest -c python/pyproject.toml python/tests
```

The wrapper tests check its Python API. CI additionally builds the distributions,
checks their metadata, installs the wheel, and verifies the bundled HTML,
JavaScript, manifest, and panorama assets.

Flake8 configuration is in `python/.flake8`. Run Flake8 from `python/` or select
that configuration explicitly when invoking it from another directory.

## Releases

Publish a GitHub release with a tag such as `frontend-1.3.0b8`. The frontend distribution workflow
publishes `python/dist/` to PyPI after shared validation, using `1.3.0b8` as the
distribution version. Version discovery recognizes prefixed frontend tags and
historical unprefixed or `v`-prefixed tags in the parent repository and ignores
SDK tags. Only `frontend-` releases trigger new Python publications. The same release also
publishes the verified static assets as `@bedrock-server-manager/frontend` on npm,
using SemVer prerelease spelling. Both archives use the same compiled web build.
The GitHub workflow uses the existing `release` environment and PyPI
trusted publisher. See the
[workspace release guide](https://github.com/DMedina559/bsm-frontend#releases)
for the independent SDK release process.
