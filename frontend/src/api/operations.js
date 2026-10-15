import { createApiClient } from "@bedrock-server-manager/api-client";
import { request } from "./transport";
export const {
  callOperation,
  resolveOperationUrl,
  createOperationClient,
  discoverOperationClient,
} = createApiClient({ request });
