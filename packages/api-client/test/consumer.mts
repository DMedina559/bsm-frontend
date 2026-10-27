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
const registry = buildOperationRegistry({ openapi: "3.1.0", paths: {} });
Object.values(registry).forEach((operation) => operation.method.toUpperCase());

// These operations belong to a configured client, not the package namespace.
// @ts-expect-error No unconfigured free operation function is exported.
import { callOperation } from "@bedrock-server-manager/api-client";
const dynamic = client.createOperationClient({ paths: {} });
await dynamic.callOperation("plugin_operation", {
  path: { server_name: "Survival" },
});
const discovered = await client.discoverOperationClient();
await discovered.callOperation("plugin_operation");

const health = await client.callOperation("get_application_health");
if (health) {
  const pid: number = health.pid;
  const version: string = health.version;
  const instance: string | null | undefined = health.instance_id;
  console.log(pid, version, instance);
}

// Generated backup metadata can be passed directly to the typed creation API.
import { contractMetadata } from "../dist/metadata.js";
const contentBody: import("../dist/generated/contract.js").components["schemas"]["SnapshotCreatePayload"] =
  {
    mode: "selected",
    components: [...contractMetadata.backupContents.defaults],
  };
void contentBody;
