import { application } from "../app/application";
import { createApiClient } from "@bedrock-server-manager/api-client";
import { request } from "./transport";
export const {
  callOperation,
  inspectBackendContract,
  resolveOperationUrl,
  createOperationClient,
  discoverOperationClient,
} = createApiClient({ request });

application.configureOperationCaller(callOperation);
