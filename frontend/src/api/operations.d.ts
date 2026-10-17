import { createApiClient } from "@bedrock-server-manager/api-client";
export const callOperation: ReturnType<typeof createApiClient>["callOperation"];
export const resolveOperationUrl: ReturnType<
  typeof createApiClient
>["resolveOperationUrl"];
export const createOperationClient: ReturnType<
  typeof createApiClient
>["createOperationClient"];
export const discoverOperationClient: ReturnType<
  typeof createApiClient
>["discoverOperationClient"];

export const inspectBackendContract: ReturnType<
  typeof createApiClient
>["inspectBackendContract"];
