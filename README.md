# Bedrock Server Manager frontend

An npm workspace containing the BSM web interface and its reusable API client,
application runtime, and preference storage. A separate Python distribution
provides the compiled web interface to the Bedrock Server Manager backend.

## Quick start

Install **Node.js 22.12 or later** and run these commands from the repository root:

```sh
npm ci
npm run dev
```

Open the development URL printed by Vite, including its `/app/` path. Run the BSM
backend separately; the development proxy defaults to `http://localhost:11325`.
To change it, create `frontend/.env.local`:

```dotenv
VITE_API_URL=http://localhost:11325
```

Restart Vite after changing this file. Python is needed only for backend contract
export or Python packaging, not for ordinary frontend development.

`npm ci` installs the exact locked dependencies and prepares the shared packages.
It replaces the existing dependency installation and leaves the lockfile unchanged.
Use `npm install` when intentionally changing dependencies, and commit the updated
root lockfile with the manifest changes.

## Repository layout

| Location                                              | Responsibility                                              | Delivery               |
| ----------------------------------------------------- | ----------------------------------------------------------- | ---------------------- |
| [frontend/](frontend/README.md)                       | React interface and browser adapters                        | Static web application |
| [packages/api-client/](packages/api-client/README.md) | Typed operations, HTTP transport, schema discovery          | Publishable npm SDK    |
| [packages/runtime/](packages/runtime/README.md)       | Session, state, metrics, operation, and socket coordination | Private workspace      |
| [packages/storage/](packages/storage/README.md)       | Validated, versioned preferences                            | Private workspace      |
| [python/](python/README.md)                           | Python wrapper, packaging configuration, and tests          | PyPI distribution      |
| scripts/                                              | Shared build and validation commands                        | Repository tooling     |

Build and test tools are declared in the root manifest. Shared libraries receive
platform dependencies explicitly; browser storage, DOM behavior, and React
integration belong to the web application.

## Commands

Run these commands from the repository root.

| Command                  | Purpose                                                                       |
| ------------------------ | ----------------------------------------------------------------------------- |
| `npm run dev`            | Build shared libraries and start Vite                                         |
| `npm run build`          | Build shared libraries and production web assets                              |
| `npm run build:packages` | Refresh library outputs under `packages/*/dist/`                              |
| `npm run check`          | Build libraries; check generation, lint, types, tests, and packed consumers   |
| `npm test`               | Run frontend and library tests                                                |
| `npm run api:check`      | Check that committed API types and operation metadata match the pinned schema |
| `npm run api:generate`   | Regenerate API types and metadata, then rebuild the SDK                       |
| `npm run packages:check` | Verify isolated package installation, exports, and consumer types             |
| `npm run build:python`   | Build the web interface and its Python distributions                          |

`npm run check` does not run browser scenarios or build the Python distribution.
See the [frontend validation guide](frontend/README.md#validation) and
[Python build guide](python/README.md#build-from-a-checkout) for those checks.
Workspaces also expose their own commands, for example:

```sh
npm run check --workspace=@bedrock-server-manager/api-client
```

Rebuild shared libraries after editing their source while Vite is running.
Generated outputs are not committed.

## Build outputs

| Output                            | Contents                                                          |
| --------------------------------- | ----------------------------------------------------------------- |
| `packages/*/dist/`                | Library JavaScript, plus declarations and metadata where provided |
| `frontend/dist/`                  | Complete production HTML, assets, and public files                |
| `python/src/bsm_frontend/static/` | Web assets copied during Python packaging                         |
| `python/dist/`                    | Python wheel and source archive                                   |

A normal npm build does not require Python. For Python delivery, install Python
3.11 or later and `python -m pip install build`, then run `npm run build:python`.
The installed backend continues to use `bsm_frontend.get_static_dir()`.

## OpenAPI contract

The backend is the source of truth for API paths, operation IDs, and models.
Install `bedrock-server-manager` from the intended backend checkout in your Python
environment. From this repository's root, export and regenerate the contract:

```sh
python -m bedrock_server_manager.web.contract --output packages/api-client/src/generated/openapi.json
npm run api:generate
npm run check
```

Review and commit the schema and generated files together. Generation belongs to
the API client workspace. The backend-contract workflow compares the pinned
schema with backend `dev`; using the SDK does not require Python or a running
backend until requests are sent.

## Releases

The SDK and frontend/Python distribution have independent release versions.
The root workspace, runtime, and storage packages are private.

| Release         | GitHub release tag                      | Workflow                 | Required publishing setup                                                         |
| --------------- | --------------------------------------- | ------------------------ | --------------------------------------------------------------------------------- |
| API client      | `api-client-v<SDK version>`             | `publish-api-client.yml` | `npm-release` environment and its `NPM_TOKEN` secret with access to the npm scope |
| Frontend/Python | Frontend version tag, such as `1.3.0b8` | `publish.yml`            | Existing PyPI trusted publisher and `release` environment                         |

For an SDK release, update `packages/api-client/package.json`, refresh the root
lockfile with `npm install --package-lock-only --ignore-scripts`, and commit both.
The release tag must exactly match that package version. GitHub prereleases
publish to npm's `next` tag; other SDK releases publish to `latest`.

Frontend/Python releases run the shared validation workflow before publishing.
SDK tags do not trigger Python publication or influence Python/frontend version
discovery. Library builds and local package checks do not publish to a registry.

## Support and license

Report web interface, JavaScript SDK, and packaging issues in
[this repository](https://github.com/DMedina559/bsm-frontend/issues). Include the
frontend and backend versions, reproduction steps, and relevant output.

This repository uses the [MIT license](LICENSE).
