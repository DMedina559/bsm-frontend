import { createApiClient } from "@bedrock-server-manager/api-client";
import { createHttpTransport } from "@bedrock-server-manager/api-client/transport";
import { createUrlResolver } from "@bedrock-server-manager/api-client/urls";

const client = createApiClient(
  createHttpTransport({
    resolveApiUrl: createUrlResolver("https://bsm.example/prefix"),
    getToken: async () => "token",
  }),
);
const fleet = await client.callOperation("list_servers");
fleet.servers?.forEach((server) => server.name.toUpperCase());
// @ts-expect-error Unknown operations must remain rejected.
await client.callOperation("missing_operation");
// @ts-expect-error Required path parameters must remain required.
await client.callOperation("get_properties");

import { buildOperationRegistry } from "@bedrock-server-manager/api-client/operationRegistry";
import { createPreferenceStore } from "@bedrock-server-manager/storage";
const registry = buildOperationRegistry({ openapi: "3.1.0", paths: {} });
Object.values(registry).forEach((operation) => operation.method.toUpperCase());
const store = createPreferenceStore();
const density = store.read("account", "density", "compact");
density.toUpperCase();
