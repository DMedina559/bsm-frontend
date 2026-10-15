# BSM API client

Browser-independent operation client generated from the backend OpenAPI contract.
Uses standard Fetch, URL, AbortSignal, FormData, and Blob APIs. Node.js 22 or later
provides these APIs; other environments can supply their own Fetch implementation.

```js
import { createApiClient } from "@bedrock-server-manager/api-client";
import { createHttpTransport } from "@bedrock-server-manager/api-client/transport";

// Supply your application's credential provider.
const getToken = async () => process.env.BSM_TOKEN ?? null;
const transport = createHttpTransport({
  baseUrl: "https://bsm.example/ingress/instance",
  getToken,
});
const client = createApiClient(transport);
const fleet = await client.callOperation("list_servers");
```

Each client has its own request implementation and credentials. Absolute backend
URLs are required unless supplying `resolveApiUrl`. API paths retain the backend
prefix, and the default resolver rejects foreign origins and URL credentials.
The browser adapter additionally enforces its page's mixed-content policy.

Generated operation calls have typed inputs and successful responses. An explicit
`createOperationClient(schema)` or `discoverOperationClient(url)` uses dynamic
operation IDs for plugin contracts and returns unknown data. Discovery does not
replace the pinned core contract.

The transport accepts asynchronous token providers, request cancellation, timeout,
binary responses, and injected Fetch. `prepareRequest` supplies an application
lifecycle assertion; it runs before sending and after receiving/reading responses.
`onResponse` observes successful results for application-owned operation tracking.
There are no automatic retries of writes.

`ApiError` retains backend status, code, details, and committed operation results.
Downloads return blobs; presentation and saving belong to the application.

Generate and check the pinned contract using the repository root
`api:generate` and `api:check` scripts. Pack with `npm pack --workspace=@bedrock-server-manager/api-client`.

## Build and release

Run `npm run build --workspace=@bedrock-server-manager/api-client` from the root.
The SDK ships dependency-free ESM JavaScript, JSON operation metadata, and type
declarations from `dist/`; source, test fixtures, and the full backend schema are
not included. `npm pack` rebuilds this output before creating the archive.

The workspace owns `api:generate`, `api:check`, `lint`, `test`, `typecheck`, and
`check`. Generation scripts live in `scripts/` within this package. The root
provides convenient aliases. Runtime-discovered plugin schemas retain dynamic
operation IDs; the generated core client remains pinned.

SDK versions use SemVer independently of frontend releases. Publish a GitHub
release named `api-client-v<version>` after committing the matching package
version and lockfile. The dedicated npm workflow validates the package and
consumer types before publishing. See the repository release guide for registry
credentials and prerelease tags.
