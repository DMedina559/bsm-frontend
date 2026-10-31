# Bedrock Server Manager frontend

An npm workspace containing the BSM web interface and its reusable API client,
application runtime, and preference storage. A separate Python distribution
provides the compiled web interface to the Bedrock Server Manager backend. The
same verified assets can also be distributed as a static npm package.

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

| Location                                              | Responsibility                                              | Delivery                    |
| ----------------------------------------------------- | ----------------------------------------------------------- | --------------------------- |
| [frontend/](frontend/README.md)                       | React interface and browser adapters                        | Static web application      |
| [packages/api-client/](packages/api-client/README.md) | Typed operations, HTTP transport, schema discovery          | Publishable npm SDK         |
| [packages/runtime/](packages/runtime/README.md)       | Session, state, metrics, operation, and socket coordination | Publishable npm library     |
| [packages/storage/](packages/storage/README.md)       | Validated, versioned preferences                            | Publishable npm library     |
| [packages/frontend/](packages/frontend/README.md)     | Static npm distribution manifest and hosting guide          | Publishable frontend assets |
| [python/](python/README.md)                           | Python wrapper, packaging configuration, and tests          | PyPI distribution           |
| scripts/                                              | Shared build and validation commands                        | Repository tooling          |

Build and test tools are declared in the root manifest. Shared libraries receive
platform dependencies explicitly; browser storage, DOM behavior, and React
integration belong to the web application.

## Commands

Run these commands from the repository root.

| Command                         | Purpose                                                                       |
| ------------------------------- | ----------------------------------------------------------------------------- |
| `npm run dev`                   | Watch shared libraries and start Vite                                         |
| `npm run build`                 | Build shared libraries and production web assets                              |
| `npm run build:packages`        | Refresh library outputs under `packages/*/dist/`                              |
| `npm run check`                 | Build libraries; check generation, lint, types, and tests                     |
| `npm test`                      | Run frontend and library tests                                                |
| `npm run api:check`             | Check that committed API types and operation metadata match the pinned schema |
| `npm run api:generate`          | Regenerate API types and metadata, then rebuild the SDK                       |
| `npm run pack:frontend`         | Pack the verified frontend for npm after Python asset staging                 |
| `npm run check:implementations` | Check shared JavaScript implementations and typed factory boundaries          |
| `npm run build:editable`        | Build the frontend and copy assets into the editable Python package           |
| `npm run build:python`          | Build the web interface and its Python distributions                          |

`npm run check` does not run browser scenarios or build the Python distribution.
See the [frontend validation guide](frontend/README.md#validation) and
[Python build guide](python/README.md#build-from-a-checkout) for those checks.
Workspaces also expose their own commands, for example:

```sh
npm run check --workspace=@bedrock-server-manager/api-client
```

`npm run dev` rebuilds shared libraries as their source changes. To run the
processes separately, use `npm run dev:packages` and `npm run dev:web` in separate
terminals. Generated outputs are not committed.

## Build outputs

| Output                            | Contents                                                          |
| --------------------------------- | ----------------------------------------------------------------- |
| `packages/*/dist/`                | Library JavaScript, plus declarations and metadata where provided |
| `frontend/dist/`                  | Complete production HTML, assets, and public files                |
| `python/src/bsm_frontend/static/` | Web assets copied during Python packaging                         |
| `frontend/build/artifacts/`       | Prebuilt npm frontend archive                                     |
| `python/dist/`                    | Python wheel and source archive                                   |

A normal npm build does not require Python. For Python delivery, install Python
3.11 or later and `python -m pip install build`, then run `npm run build:python`.
The installed backend continues to use `bsm_frontend.get_static_dir()`.

For an editable frontend install from this checkout, run:

```sh
python -m pip install -e ./python
npm run build:editable
```

`build:editable` builds the shared libraries and web interface, then replaces
`python/src/bsm_frontend/static/` with the fresh assets. It does not run Python,
build wheels/source archives, or change existing `python/dist/` artifacts.
After subsequent frontend edits, rerun `npm run build:editable` and refresh the
browser. The editable install must point to this frontend checkout; an editable
backend install alone does not make the frontend package editable.

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
schema with backend `dev`. Generated metadata records a SHA-256 contract
fingerprint, the source exporter, and supported operation IDs; using the SDK does not require Python or a running
backend until requests are sent.

## Releases

The SDK, runtime, storage, and frontend/Python distribution have independent
release versions. The root workspace and source web application stay private.

| Release         | GitHub release tag                               | Workflow      | Required publishing setup                                                    |
| --------------- | ------------------------------------------------ | ------------- | ---------------------------------------------------------------------------- |
| API client      | `api-client-v<SDK version>`                      | `publish.yml` | npm trusted publishing through the `npm-release` environment                 |
| Runtime         | `runtime-v<SemVer>`                              | `publish.yml` | npm trusted publishing through the `npm-release` environment                 |
| Storage         | `storage-v<SemVer>`                              | `publish.yml` | npm trusted publishing through the `npm-release` environment                 |
| Frontend assets | `frontend-<version>`, such as `frontend-1.3.0b8` | `publish.yml` | PyPI trusted publisher (`release`) and npm trusted publisher (`npm-release`) |

For an SDK release, publish a GitHub release tagged `api-client-v0.1.1`, for example.
The workflow validates the SemVer tag and sets the SDK package and lockfile
version in its temporary checkout before validation and publication. No manual
manifest update or version commit is required. The committed version remains a
development baseline; the published package gets its version from the release tag.
For a beta, use a tag such as `api-client-v0.2.0-beta.1` and mark the GitHub release
as a prerelease. SemVer prereleases always publish to npm's `next` tag, even if
the GitHub prerelease checkbox is omitted; stable releases use `latest` unless
explicitly marked as GitHub prereleases.

Runtime and storage follow the same tag-derived versioning and npm channel rules,
using tags such as `runtime-v0.1.0-beta.1` and `storage-v0.1.0-beta.1`.
The shared workflow validates and publishes only the selected package. Library
archives pass isolated consumer checks before publication; frontend releases
retain their full application and backend-contract validation. The npm publishing
job checks the archive's package name, version, and public visibility and publishes
it without rebuilding.

Frontend releases run shared validation, then publish the verified Python and
npm archives without rebuilding. `frontend-1.3.0b8` produces Python version
`1.3.0b8` and npm `@bedrock-server-manager/frontend` version `1.3.0-beta.8`.
The source frontend-assets workspace stays private to prevent accidental
publication of an unstaged package; the prepared archive is public.
The `frontend-` prefix identifies the release; the published Python version and
displayed application version omit it. Historical unprefixed and `v`-prefixed
frontend tags remain readable for local builds, but new Python publications
require a `frontend-` release tag. Publishing a GitHub release triggers the
corresponding workflow; pushing a tag alone does not publish.
SDK tags do not trigger Python publication or influence Python/frontend version
discovery. Library builds and local package checks do not publish to a registry.

## Support and license

Report web interface, JavaScript SDK, and packaging issues in
[this repository](https://github.com/DMedina559/bsm-frontend/issues). Include the
frontend and backend versions, reproduction steps, and relevant output.

This repository uses the [MIT license](LICENSE).

### Global diagnostic activity

Diagnostics → Activity shows active/recent events and operation outcomes across
all execution chains, with server/name/owner/sequence/correlation filters, listener
configuration, and links to correlated traces. Enable automatic refresh to poll
every 15 seconds while viewing activity. This is bounded metadata, not an unlimited
event log. Unavailable sources and partial views are labeled explicitly. Global
activity requires a backend exposing `get_diagnostic_activity`; other diagnostics
remain usable on older backends. Traces now include operation ancestry and outcomes.

### Backup verification and scheduling

The administrator **Scheduler** page manages named backup and verification jobs,
server selection, timing, weekdays, timezone, catch-up, and recent run outcomes.
Existing backup schedules remain compatible. Full verification after creation,
periodic verification, and automatic recovery drills are opt-in on new backend
installations. Restore always validates integrity. The backup inspector fits the
viewport, wraps paths, and displays a compact summary and capture timings.
Start/stop/restart use the existing endpoints and allow long pre-start hooks to
finish without the client's ordinary 30-second timeout. Explicit caller timeout
overrides remain supported; server/proxy limits still apply.

### HTTP access metadata and connection authentication

The API Explorer displays the connected account's permissions, operation
requirements, role labels, and contextual policy notices from `x-bsm-access`.
Older servers remain usable and show unknown access metadata. Server responses,
including 403, remain authoritative; static permissions do not resolve ownership
or custom policies.

Only the embedded default connection permits same-origin cookie recovery.
Saved-instance workspaces and standalone connections omit cookies for all API
requests, including login and uploads, and use backend-scoped bearer tokens.
Their logout clears that instance's saved credentials. The embedded default
logout also calls the backend to clear its cookie. Neither revokes JWTs retained
elsewhere. Endpoint scopes describe role capabilities, not restricted token grants.

### Integration credentials and server assignments

Account settings can create named, expiring integration credentials with explicit
capabilities and optional server limits. Copy the secret once; subsequent lists
show metadata and a revoke action. The secret stays outside query caches and
browser persistence. Each credential is bounded by the owner's current role and
server assignments.

Administrators can edit another non-admin account's server access in the Users
editor. Assigned mode grants only selected capabilities on selected servers;
new servers receive no automatic access. Existing accounts retain their role's
all-server behavior. Account changes refresh access metadata, navigation, cached
queries, and the live API explorer. Backends without this metadata keep their
existing compatibility behavior.

Account security now groups Sessions, Integrations, My access, Activity, and
Password & MFA. Users can rename and revoke logins, sign out other sessions, rotate
integration credentials, and enroll an authenticator with one-use recovery codes.
Administrators can inspect and revoke account sessions and reset MFA.

The embedded app uses an HttpOnly login cookie without copying the JWT into
JavaScript storage. Cookie mutations send an in-memory CSRF proof. Saved instances
and external clients use bearer mode. Passwords and one-time security secrets are
excluded from the shared query/mutation cache. Sensitive changes prompt for recent
password and factor verification, then ask users to retry the action explicitly.

Choose **Never expire** when creating an integration credential to keep it valid
until revoked (`expires_in_days: null` in the API). The default remains 30 days;
rotation preserves a non-expiring credential's lack of a deadline. Login sessions
retain their configured expiry limits. Login asks for an authenticator/recovery
code only after the server validates the username/password and requires MFA.

**Frontend settings** is the central home for themes/palettes/backgrounds,
display and fleet preferences, browser recovery, connections, and frontend
recording. It is available to every signed-in account from the sidebar, Account,
and application Settings. Existing account/backend-scoped preferences are reused;
`/appearance` redirects to the Appearance category. Account focuses on identity,
sessions, integration credentials, and security. Frontend diagnostics keeps its
history tools and links to the central recording controls.

Saved instance connections use the same progressive MFA prompt as workspace
login. Administrators required to enroll are guided to Account, with recovery
codes kept visible until acknowledged. Sessions show the current login first,
keep expired/revoked history collapsed, distinguish idle from absolute expiry,
and show the remaining recent-verification time. Current-device sign-out does
not require another password prompt. Owned security notices appear in the
existing notification history. New/reset passwords use a 15-character minimum;
existing login passwords remain accepted. Passkeys are deferred.
