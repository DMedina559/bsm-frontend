import { createApiClient } from "@bedrock-server-manager/api-client";
import { request } from "./transport";

export const loadExplorerSchema = (signal) =>
  request("/api/openapi.json", { signal });
export const createExplorerClient = (schema) =>
  createApiClient({ request }).createOperationClient(schema);

export async function executeExplorerOperation(schema, id, options) {
  let metadata;
  const started = performance.now();
  const client = createApiClient({
    request: (url, settings) =>
      request(url, {
        ...settings,
        onResponseMetadata: (value) => {
          metadata = value;
        },
      }),
  }).createOperationClient(schema);
  try {
    const data = await client.callOperation(id, options);
    return {
      ...metadata,
      durationMs: Math.round(performance.now() - started),
      data,
    };
  } catch (error) {
    return {
      ...metadata,
      status: error.status ?? metadata?.status,
      durationMs: Math.round(performance.now() - started),
      data: error.data,
      error: error.message,
    };
  }
}
