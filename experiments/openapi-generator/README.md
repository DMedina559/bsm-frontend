# OpenAPI Generator frontend prototype

An isolated trial of OpenAPI Generator **7.26.0**, using the real checked-in BSM
OpenAPI 3.1 contract. Production frontend imports, the published API client,
WebSocket runtime, discovery, and Python client are unchanged.

## Run

Requirements: the repository's Node version, npm dependencies, and Java 11+.

```sh
npm ci
npm run prototype:openapi:test
```

The generator JAR is downloaded from Maven Central, verified against a pinned
SHA-256, and cached locally. `OPENAPI_GENERATOR_JAR` can point to an existing JAR;
it must have the same checksum. Generation always starts from an empty output
directory. Generated files, compiled files, and the JAR are not committed.

Input: `packages/api-client/src/generated/openapi.json`.

Output: `experiments/openapi-generator/generated/`.

The test command generates the SDK, compiles it and a strict TypeScript consumer,
and runs Fetch contract tests without contacting a live BSM instance. Regenerate
our existing backend contract before this command when evaluating backend changes.

## What works in this trial

- Every operation in the input schema has a generated method (167 in this snapshot).
- Strict TypeScript compilation, required body fields, optional nullable fields,
  and null-only fields.
- Per-instance base URLs, backend path prefixes, and bearer tokens.
- Password login through URL-encoded form data, with bearer-mode selection and no
  ambient token or cookie attached.
- JSON bodies preserve omitted properties versus explicit `null`.
- Multipart archive uploads, encoded path parameters, Blob downloads, and raw
  response streaming through `pipeTo`.
- BSM `ApiError` metadata, including committed/incomplete operations.
- Caller-provided abort signals, in-flight cancellation, and no automatic retries.

## Findings and configuration decisions

1. **Default model conversion does not compile against this schema.** Null-only
   fields in `CompletedItem`, `FailedItem`, and `SkippedItem` reference a nonexistent
   generated `Null` model. No generated files were patched.
2. `withoutRuntimeChecks: true` uses inline model declarations and raw JSON rather
   than generated converters. Combined with explicit `null`/`Null` type mappings,
   the null-only fields compile correctly. This option disables generated model
   checks and conversions; types alone do not validate responses at runtime.
3. Original property names and string dates preserve BSM's wire representation.
   A direct replacement would otherwise change snake_case/date handling.
4. The generated auth code treats OAuth2 and HTTP bearer token callbacks
   differently. `client.mjs` injects one bearer header through middleware instead
   of configuring both generator auth callbacks.
5. API operations become methods grouped into API classes. For example,
   `client.AccountManagementApi.getAccount()` replaces a generated direct call;
   the existing typed `callOperation('get_account')` surface is not reproduced.
6. The generator itself warns that OpenAPI 3.1 support remains beta. Compiling all
   output and testing wire behavior must remain part of an adoption decision.

## Still required before adoption

- A deliberate choice between keeping the operation-ID facade and migrating
  frontend callers to generated methods. Body parameter names are often model
  names (for example `CreateIntegrationToken`), which differ from our `body` option.
- Session-generation guards, session reset cancellation, deadlines, and token
  refresh/MFA coordination. This trial only accepts explicit abort signals.
- Upload/download progress callbacks, download-to-file UI, and their cleanup paths.
  Raw streaming works, but the existing high-level progress API is not replicated.
- Dynamic plugin endpoint discovery and capability/access metadata. Static SDK
  methods cannot discover operations added after generation.
- Validation against a live backend and the frontend's full browser workflows.
- A Python client trial; this branch does not demonstrate cross-language parity.
- A separate TypeScript 7 migration. This prototype compiles using the repository's
  current TypeScript and does not change compiler-API tooling.

## Assessment

The generator can supply a functioning static HTTP SDK without custom templates,
using a small BSM-specific adapter. It is not yet a drop-in replacement for our
client. The biggest decision is whether the generated endpoint classes reduce
maintenance enough to justify adapting the operation facade and session runtime.
Keep this experiment separate until those integration costs are measured.
