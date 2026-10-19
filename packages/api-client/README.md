# BSM JavaScript API client

A browser-independent ESM client for Bedrock Server Manager. Core operation names,
parameters, request bodies, and successful response types come from the pinned
backend OpenAPI contract.

The runtime requires the standard Fetch, URL, AbortSignal, FormData, and Blob APIs,
as provided by Node.js 22 or later and compatible browser environments. Repository
development uses Node.js 22.12 or later.

## Use the client

This package is built within the workspace and is configured for npm publication.
Registry installation requires an SDK release. To test an unreleased checkout,
run root `npm ci`, then `npm pack --workspace=@bedrock-server-manager/api-client`.
Install the resulting archive in the consuming project with `npm install` and
its archive path. The archive contains the built SDK and needs no Python tooling.

The following Node.js example reads its backend URL and token from the environment:

```js
import { createApiClient } from "@bedrock-server-manager/api-client";
import { createHttpTransport } from "@bedrock-server-manager/api-client/transport";

const client = createApiClient(
  createHttpTransport({
    baseUrl: process.env.BSM_URL ?? "http://localhost:11325",
    getToken: () => process.env.BSM_TOKEN ?? null,
  }),
);

const fleet = await client.callOperation("list_servers");
console.log(fleet.servers);
```

Supply a backend-issued token for authenticated operations. `getToken` may return
a token synchronously or through a promise, so the application can use its own
credential store. Separate client instances can use separate backends and accounts.

`baseUrl` must be an absolute HTTP or HTTPS URL. An ingress prefix is preserved:
`https://bsm.example/ingress/instance` resolves operation paths under that prefix.
The default resolver rejects foreign origins and credentials embedded in URLs.
Applications may instead supply `resolveApiUrl`; the frontend's adapter also
applies its HTTPS/mixed-content policy.

## Parameters and cancellation

Operations use their backend `operationId`, not a handwritten route wrapper.
Path and query parameters are checked against the operation registry. TypeScript
consumers receive generated input and successful response types.

Using the client above:

```js
const controller = new AbortController();
const result = await client.callOperation("get_properties", {
  path: { server_name: "Survival" },
  signal: controller.signal,
  timeout: 10000,
});
console.log(result.properties);
```

Call `controller.abort()` to cancel pending work. Timeouts default to 30 seconds.
Abort and timeout errors propagate separately from `ApiError`. Set `timeout: 0` for long archive transfers without a deadline; session and explicit cancellation still apply.

The transport encodes JSON, form, and multipart bodies according to the operation
metadata. `responseType: "blob"` requests a binary response. Saving or sharing the
returned blob belongs to the application.

## Errors and lifecycle integration

Import `ApiError` from `@bedrock-server-manager/api-client/transport`. It preserves
the response status, backend error code, details, and committed-operation result.
Network failures use status `0`. If `committed` is true, refresh the relevant state
before deciding whether to retry the operation. Writes are not retried automatically.

Applications can integrate their own request lifecycle with these transport options:

| Option           | Purpose                                                                                 |
| ---------------- | --------------------------------------------------------------------------------------- |
| `fetch`          | Supply a Fetch implementation                                                           |
| `captureSession` | Capture an application session and its cancellation signal                              |
| `prepareRequest` | Return an assertion that rejects stale work before sending and after reading a response |
| `onResponse`     | Observe successful responses for application-owned operation tracking                   |
| `logger`         | Provide debug, warning, and error logging                                               |

## Plugin discovery

`client.createOperationClient(schema)` interprets an explicitly supplied OpenAPI
schema. `client.discoverOperationClient(schemaUrl)` fetches one through the same
authenticated transport. Use the schema URL supplied by the backend or plugin.

Discovered operation IDs are dynamic and return unknown data; validate that data
in the consuming application. Discovery does not replace the pinned core registry.

## Workspace commands

Run these commands from the repository root:

```sh
npm run build --workspace=@bedrock-server-manager/api-client
npm run check --workspace=@bedrock-server-manager/api-client
```

The workspace owns `api:generate`, `api:check`, `lint`, `test`, and `typecheck`.
Generation lives in `packages/api-client/scripts/`; root aliases are documented in
the [workspace guide](https://github.com/DMedina559/bsm-frontend#openapi-contract).

Archives include dependency-free JavaScript, JSON operation metadata, and type
declarations from `dist/`. They exclude source, test fixtures, and the full backend
schema. `npm pack` rebuilds this output before creating an archive.

## Releases

SDK versions use SemVer independently of frontend releases. A GitHub release tag
must be `api-client-v<version>`, such as `api-client-v0.1.1` or
`api-client-v0.2.0-beta.1`. The npm workflow derives the published package version
from that tag, updates the manifest and lockfile in its temporary checkout, and
checks the SDK and isolated consumer before publication. No manual package
version update or version commit is needed. Mark beta releases as GitHub
prereleases for clarity. SemVer prerelease versions automatically use npm's
`next` tag even if the GitHub flag is omitted. See the
[release guide](https://github.com/DMedina559/bsm-frontend#releases) for credentials
and prerelease tags.

## Contract compatibility

`backend-source.json` pins the supported backend commit used by release validation
and the packaged application's integration smoke test. Update it alongside reviewed
contract changes. The separate backend-contract workflow also compares against
backend `dev` to detect upstream drift.

`@bedrock-server-manager/api-client/metadata` exports `contractMetadata` with the
canonical schema fingerprint, exporter provenance, and operation IDs.
`compareCapabilities(schema, requiredOperations)` compares an advertised OpenAPI
contract without assuming frontend and backend version numbers must match.
A configured client also exposes `inspectBackendContract({ signal, timeout })` to
fetch that information through the authenticated transport. Discovery is explicit;
it does not replace the client's pinned types or silently add core operations.

Request timeouts and cancellation cover asynchronous credentials and response
body decoding. Header names are case insensitive. The default URL resolver
rejects traversal and requests outside the configured backend's origin and path
prefix. A custom resolver remains responsible for its own destination policy.

Archive transfers support native browser progress through `onUploadProgress`
(multipart XMLHttpRequest) and `onDownloadProgress`. For large downloads, pass a
`WritableStream<Uint8Array>` as `downloadTo` with `responseType: "blob"`; the
transport writes with backpressure, closes on success, and aborts partial output
on cancellation or failure. Without a destination it returns a Blob. These
options share the normal bearer authentication, backend URL resolution, session
guards, and abort signals. A timeout of zero disables only the deadline.
