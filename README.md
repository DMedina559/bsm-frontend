# Bedrock Server Manager frontend

An npm workspace containing the BSM web interface and its reusable API client,
application runtime, and preference storage. A separate Python distribution
provides the compiled web interface to the Bedrock Server Manager backend. The
same verified assets can also be distributed as a static npm package.

## Quick start

Install **Node.js 22.13+ (22.x) or 24+** and run these commands from the repository root:

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

Publish one GitHub release tagged `v<major>.<minor>.<patch>` to release the frontend
and all shared packages together. For example, `v1.4.0` publishes:

| Distribution                         | Version |
| ------------------------------------ | ------- |
| `@bedrock-server-manager/api-client` | `1.4.0` |
| `@bedrock-server-manager/runtime`    | `1.4.0` |
| `@bedrock-server-manager/storage`    | `1.4.0` |
| `@bedrock-server-manager/frontend`   | `1.4.0` |
| PyPI `bsm-frontend`                  | `1.4.0` |

Use `v1.4.0-alpha.1`, `v1.4.0-beta.1`, or `v1.4.0-rc.1` for prereleases.
All npm packages receive the same SemVer version and the `next` channel; Python
uses the equivalent `1.4.0a1`, `1.4.0b1`, or `1.4.0rc1` spelling. Stable releases
use `latest` unless explicitly marked as GitHub prereleases. Arbitrary prerelease
labels and build metadata are rejected to keep the npm/Python mapping unambiguous.

`publish.yml` derives every package version from the tag in a disposable checkout,
including workspace lockfile entries. No manual version bump commit is required.
Every package is released even when only one changed. The root workspace, source
web application, and unstaged frontend-assets workspace remain private.
The mobile app keeps its own release cycle and can pin one shared package version.

Both registry jobs wait for full frontend/backend/browser tests, lint, contract
and type checks, and isolated SDK archive checks. The workflow packs the tested
SDKs and the frontend assets, then publishes those verified archives without
rebuilding. Python and npm frontend assets come from the same compiled web build.
Only publishing a GitHub release triggers publication; pushing a tag alone does
not. Individual `api-client-v`, `runtime-v`, `storage-v`, and `frontend-` release
tags are no longer accepted. Historical frontend tags remain readable locally.

Configure npm trusted publishing for **each of the four packages**, using
`publish.yml` and the `npm-release` environment. Enable **Allow npm dist-tag** for
retry-time channel repair. Python uses the existing PyPI trusted publisher and
`release` environment. No registry tokens are required.

Publication is not atomic across packages or registries. Rerun failed jobs on the
same GitHub release to finish a partial release. Before any npm publication, the
job validates the full four-archive set and checks existing versions: it skips
only archives with identical SHA-512 integrity, repairs their intended channel
when necessary, and publishes missing packages. Different bytes at an existing
version fail rather than being overwritten; use a new tag/version in that case.
Registry errors other than a missing version fail the job. PyPI retries skip
files already uploaded. Release publication is serialized without cancelling an
in-progress publish. Inspect both registry jobs before announcing availability.

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

### Recovery-code saves

The Account page uses direct text-file saving where the browser supports it.
Other browsers and restricted embedded views use a download fallback. Codes stay
visible when saving is cancelled or fails, and the fallback file remains valid
until the codes are dismissed or the view closes. Direct saving reports success
only after writing and closing the selected file. Saving already displayed codes
does not require another backend request.
