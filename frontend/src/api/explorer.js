import { createApiClient } from "@bedrock-server-manager/api-client";
import { request } from "./transport";

export const loadExplorerSchema = (signal) =>
  request("/api/openapi.json", { signal });
export const createExplorerClient = (schema) =>
  createApiClient({ request }).createOperationClient(schema);

function parseDispositionFilename(headers) {
  const disposition =
    headers?.["content-disposition"] ?? headers?.["Content-Disposition"] ?? "";
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  return match?.[1] ?? "";
}

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
      filename: parseDispositionFilename(metadata?.headers),
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
